/**
 * eirene :: Content Management System
 * -----------------------------------
 * Copyright (c) 2018 CUREON
 * @License MIT
 */

// Module Imports
import * as express from 'express';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as Q from 'q';
import * as bodyParser from 'body-parser';
import * as sass from 'node-sass';
import * as typescript from 'typescript';

const pascalCase = require('pascal-case');
const prmsHBars  = require('promised-handlebars');
const ncp        = require('ncp').ncp;
const minify     = require('minify');

const handlebars = prmsHBars(require('handlebars'), { 
    Promise: Q.Promise
});

// Prerequisites
const PORT       = 30100;
let Global: any  = {};
let Modules: any = {};
let Routes: any  = {};

// Folders
const compDir: string          = __dirname + '/_compiled';
const assetDir: string         = __dirname + '/assets';
const contentDir: string       = __dirname + '/content';
const globalContentDir: string = __dirname + '/content/_global';
const moduleDir: string        = __dirname + '/modules';

// Instantiate
const app          = express();
const context: any = {
    req: null,
    res: null
}

// Config
app.use(express.static(compDir)); 
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

/**
 * Function will provide forEach async
 * @param array 
 * @param callback 
 */
async function asyncForEach(array: any, callback: any) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array)
    }
}

/**
 * PREPARE SHARED CONTENT
 * Function will load content files from _shared folder
 * and append them in order to create a larger yaml
 */
async function prepareGlobalContent() {
    const files      = fs.readdirSync(globalContentDir);
    let combinedYAML = '';

    await asyncForEach(files, async (file: string) => {
        combinedYAML += fs.readFileSync(globalContentDir + '/'+ file, 'utf8') + '\n';
    });

    return yaml.safeLoad(combinedYAML);
}

/**
 * CONTENT LOADER
 * Function will recursively scan dir for content files and
 * create a route tree with the corresponding data (/w controllers applied)
 * @param initialDir 
 * @param currentDir 
 * @param routeList 
 */
async function contentLoader(initialDir: string, currentDir: string = '', routeList: any = {}) {
    currentDir  = currentDir || initialDir;
    const files = fs.readdirSync(currentDir);

    // Run through files of current directory
    await asyncForEach(files, async (file: string) => {
        // Don't process global content
        if (file === '_global') {
            return;
        }

        // Process regular files & folders
        if (fs.statSync(currentDir + '/' + file).isDirectory()) {
            routeList = contentLoader(initialDir, currentDir + '/' + file + '/', routeList);
            
        } else {            
            // Write Route List
            const routeName = file.replace(/\.[^/.]+$/, '');
            let routePath   = (currentDir == initialDir ? '/' : '') + currentDir.substr(initialDir.length);
            
            if(routeName != 'index') {
                routePath += routeName;
            }

            // Return /w Content
            routeList[routePath] = yaml.safeLoad(fs.readFileSync(currentDir + '/'+ file, 'utf8'));
        }
    });
    return routeList;
};

/**
 * COMPONENT LOADER
 * Function will scan a dir for modules and register templates
 * as well as corresponding controllers
 * @param currentDir 
 * @param moduleList 
 */
async function moduleLoader(currentDir: string, moduleList: any = {}) {
    const files = fs.readdirSync(currentDir);

    // Run through files of current directory
    await asyncForEach(files, async (file: string) => {
        if (fs.statSync(currentDir + '/' + file).isDirectory()) {
            moduleList = await moduleLoader(currentDir + '/' + file, moduleList);
        } else {            
            const [moduleName, extension] = file.split('.');

            // Register templates
            if(extension == 'hbs') {
                handlebars.registerPartial(moduleName, fs.readFileSync(currentDir + '/' + file, 'utf8'));
            }

            // Register controllers
            if(extension == 'ts') {
                const moduleImport = await import(currentDir + '/' + file);
                moduleList[moduleName] = moduleImport;
            }
        }
    });

    return await moduleList;
};

/**
 * ASSIGN CONTROLLER
 * Function will assign a controller to a module in order
 * to compile the data the module needs to provide to the UI
 * @param moduleName 
 * @param data 
 */
async function assignController(moduleName: any, data: any) {
    const moduleConstructor = pascalCase(moduleName + ' Module'); 

    data = data || {};

    if(Modules[moduleName] && Modules[moduleName][moduleConstructor]) {
        const serviceInstance = new Modules[moduleName][moduleConstructor](context.req, context.res, data);
        
        if(serviceInstance.compile && typeof serviceInstance.compile == 'function') {
            data = await serviceInstance.compile();
        }            
    }

    return data;
}

/**
 * RENDER TEMPLATE
 * Function will render any given partial & data to HTML
 * @param moduleName 
 * @param context 
 */
async function renderTemplate(moduleName: string, data: any) { 
    let template:any;
    let html:any;
    let compData: any;

    data = data || {};

    // Propagate Data to Partials
    if (Global) {
        data.global = Global;
    }
    if (Routes) {
        data.routes = Routes;
    }

    // Render partial or fallback (if module is missing)
    if(handlebars.partials[moduleName]) {
        template = await handlebars.compile(handlebars.partials[moduleName], {noEscape:true});
        compData = await assignController(moduleName, data);
        html     = await template(compData);
    } else {
        template = await handlebars.compile(handlebars.partials['_missingModule'], {noEscape:true});
        html     = await template({data: {missingModule: moduleName}});
    }

    return new handlebars.SafeString(html).toHTML();
}

/**
 * REGISTER ROUTES
 * Function will register the routes on the app
 * and render the corresponding templates on call
 */
async function registerRoutes() {
    Object.keys(Routes).forEach((routePath: any) => {
        const objContent = Routes[routePath];
    
        app.all(routePath, async (req, res, next) => {
            context.req      = req;
            context.res      = res;
            const objClone   = JSON.parse(JSON.stringify(objContent));

            if(objClone.settings && objClone.settings.template) {
                const rndContent = await renderTemplate('core', objClone);

                res.send(rndContent);
            }
        });
    });
}

/**
 * PREPARE TEMPLATE ENGINE
 * Function will prepare the template engine
 */
function prepareTemplateEngine() {
    handlebars.registerPartial('_missingModule', '<br><span style="color: red;">Module "{{data.missingModule}}" cannot be found!</span>');
    handlebars.registerHelper('include', renderTemplate);
}

/**
 * COPY VENDOR ASSETS
 * Function will copy any vendor assets to static folder
 */
async function copyVendor() {
    ncp.limit = 16;
    ncp(assetDir + '/vendor', compDir + '/vendor', () => {});
}

/**
 * COPY MEDIA ASSETS
 * Function will copy any media assets to static folder
 */
async function copyMedia() {
    ncp.limit = 16;
    ncp(assetDir + '/media', compDir + '/media', () => {});
}

/**
 * RENDER CSS
 * Function will render the CSS from given SASS
 */
async function renderCSS() {
    await sass.render({
        file       : assetDir + '/styles/main.scss',
        outFile    : compDir + '/styles/main.css',
        outputStyle: 'compressed'
    }, (err: any, result: any) => {
        if(!err) {
            fs.writeFileSync(compDir + '/styles/main.css', result.css, 'utf8');
        }
    });
}

/**
 * RENDER TS
 * Function will render the Frontend TS to JavaScript
 */
async function renderTS() {
    const content         = fs.readFileSync(assetDir + '/scripts/main.ts', 'utf8');
    const compilerOptions = { module: typescript.ModuleKind.System };

    // Process
    const transpiled = typescript.transpile(content, compilerOptions, undefined, undefined, 'main');
    fs.writeFileSync(compDir + '/scripts/main.js', transpiled, 'utf8');

    // Minify
    await minify(compDir + '/scripts/main.js', (err: any, minified: any) => {
        if(!err) {
            fs.writeFileSync(compDir + '/scripts/main.js', minified, 'utf8');
        }
    });
}

/**
 * RUN APPLICATION
 * Function will run the server
 */
async function run() {
    console.log('--- eirene CMS v0.2 ---');
    console.log('[eirene] Initialization started ...');

    // Assets
    console.log('[eirene] Copying Assets ...');
    await copyVendor();
    await copyMedia();

    // Asset Compilation
    console.log('[eirene] Compiling CSS/TS ...');
    await renderCSS();
    await renderTS();

    // Template Engine
    console.log('[eirene] Registering Template Engine ...');
    prepareTemplateEngine();
    
    // Load Modules & Routes
    console.log('[eirene] Loading Modules & Content ...');
    Global  = await prepareGlobalContent();
    Modules = await moduleLoader(moduleDir);
    Routes  = await contentLoader(contentDir);

    // Register Routes
    console.log('[eirene] Registering Routes ...');
    await registerRoutes();

    // Open Server
    app.listen(PORT, () => {
        console.log('[eirene] Application running on port ' + PORT + ' ...');
    });
}

// Run Server
run();