// Module Imports
import * as express from 'express';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as Q from 'q';
import * as handlebarsExpress from 'express-handlebars';
import * as bodyParser from 'body-parser';
import * as sass from 'node-sass';
const pascalCase = require('pascal-case');
const promisedHandlebars = require('promised-handlebars');

const handlebars = promisedHandlebars(require('handlebars'), { 
    Promise: Q.Promise
});

// Prerequisites
let Components: any = {};
let Routes: any     = {};

// Folders
const staticFolder: string    = __dirname + '/static';
const pageFolder: string      = __dirname + '/pages';
const sharedFolder: string    = __dirname + '/shared';
const componentFolder: string = __dirname + '/components';
const styleFolder: string     = __dirname + '/styles';
const cssFolder: string       = staticFolder + '/css';

// Instantiate
const app          = express();
const context: any = {
    req: null,
    res: null
}

// Config
app.use(express.static(staticFolder)); 
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
const templateStartPoint = 'app';

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
async function prepareSharedContent() {
    const files      = fs.readdirSync(sharedFolder);
    let combinedYAML = '';

    await asyncForEach(files, async (file: string) => {
        combinedYAML += fs.readFileSync(sharedFolder + '/'+ file, 'utf8') + '\n';
    });

    return combinedYAML;
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
            const sharedContent  = await prepareSharedContent();
            routeList[routePath] = yaml.safeLoad(fs.readFileSync(currentDir + '/'+ file, 'utf8') + '\n' + sharedContent);
        }
    });
    return routeList;
};

/**
 * COMPONENT LOADER
 * Function will scan a dir for components and register templates
 * as well as corresponding controllers
 * @param currentDir 
 * @param componentList 
 */
async function componentLoader(currentDir: string, componentList: any = {}) {
    const files = fs.readdirSync(currentDir);

    // Run through files of current directory
    await asyncForEach(files, async (file: string) => {
        if (fs.statSync(currentDir + '/' + file).isDirectory()) {
            componentList = await componentLoader(currentDir + '/' + file, componentList);
        } else {            
            const [componentName, extension] = file.split('.');

            // Register templates
            if(extension == 'hbs') {
                handlebars.registerPartial(componentName, fs.readFileSync(currentDir + '/' + file, 'utf8'));
            }

            // Register controllers
            if(extension == 'ts') {
                const moduleImport = await import(currentDir + '/' + file);
                componentList[componentName] = moduleImport;
            }
        }
    });

    return await componentList;
};

/**
 * ASSIGN CONTROLLER
 * Function will assign a controller to a component in order
 * to compile the data the component needs to provide to the UI
 * @param componentName 
 * @param data 
 */
async function assignController(componentName: any, data: any) {
    const moduleName = pascalCase(componentName + ' Component'); 
    data = data || {};

    if(Components[componentName] && Components[componentName][moduleName]) {
        const serviceInstance = new Components[componentName][moduleName](context.req, context.res, data);
        
        if(serviceInstance.compile && typeof serviceInstance.compile == 'function') {
            data = await serviceInstance.compile();
        }            
    }

    return data;
}

/**
 * RENDER TEMPLATE
 * Function will render any given partial & data to HTML
 * @param componentName 
 * @param context 
 */
async function renderTemplate(componentName: string, data: any) { 
    let template:any;
    let html:any;
    let compData: any;

    // Render partial or fallback (if component is missing)
    if(handlebars.partials[componentName]) {
        template = await handlebars.compile(handlebars.partials[componentName], {noEscape:true});
        compData = await assignController(componentName, data);  
        html     = await template(data);
    } else {
        template = await handlebars.compile(handlebars.partials['_missingComponent'], {noEscape:true});
        html     = await template({data: {missingComponent: componentName}});
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
            const rndContent = await renderTemplate(templateStartPoint, objClone);

            res.send(rndContent);
        });
    });
}

/**
 * PREPARE TEMPLATE ENGINE
 * Function will prepare the template engine
 */
function prepareTemplateEngine() {
    //handlebars.registerPartial('_childLoader', '{{#if children}}{{#each children}}{{include this.type this}}{{/each}}{{/if}}');
    handlebars.registerPartial('_missingComponent', '<br><span style="color: red;">Component "{{data.missingComponent}}" cannot be found!</span>');
    handlebars.registerHelper('include', renderTemplate);
}

/**
 * RENDER CSS
 * Function will render the CSS from given SASS
 */
async function renderCSS() {
    const result = await sass.render({
        file       : styleFolder + '/main.scss',
        outFile    : cssFolder + '/main.css',
        outputStyle: 'compressed'
    }, (err, result) => {
        if(!err) {
            fs.writeFileSync(cssFolder + '/main.css', result.css, 'utf8');
        }
    });
}

/**
 * RUN APPLICATION
 * Function will run the server
 */
async function run() {
    console.log('--- EIRENE CMS v0.2 ---');
    console.log('[SERVER] Application started ...');

    // Prerequisites
    console.log('[SERVER] Compiling CSS ...');
    await renderCSS();
    prepareTemplateEngine();
    
    // Load Components & Routes
    console.log('[SERVER] Loading Components & Content ...');
    Components = await componentLoader(componentFolder);
    Routes     = await contentLoader(pageFolder);

    // Register Routes
    console.log('[SERVER] Registering Routes ...');
    await registerRoutes();

    // Open Server
    app.listen(3000, () => {
        console.log('[SERVER] Application running on port 3000');
    });
}

// Run Server
run();