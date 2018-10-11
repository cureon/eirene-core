/**
 * eirene :: Content Management System
 * -----------------------------------
 * Copyright (c) 2018 CUREON
 * @License MIT
 */

/**
 * Prereqisites
 */
import * as express from 'express';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as Q from 'q';
import * as sass from 'node-sass';
import * as typescript from 'typescript';

const pascalCase = require('pascal-case');
const prmsHBars  = require('promised-handlebars');
const ncp        = require('ncp').ncp;
const minify     = require('minify');
const mkdirp     = require('mkdirp');

/**
 * eirene :: Basic HTML Frontend
 *
 * @export
 * @class EireneHTMLPlugin
 */
export class EireneHTMLPlugin {
    /**
     * Members
     */
    private GLOBAL: any;
    private MODULES: any;
    private ROUTES: any;
    private DIRS: any; 
    private tmpEngine: any;
    private xprContext: any;

    /** 
     * Constructor
     */
    constructor(private xprApp: any) {
        // Prerequisites
        this.xprContext = {
            req: {},
            res: {}
        }
        
        // Folder Configuration
        this.DIRS = {
            COMPILED    : __dirname + '/../../_compiled/eirene-html',
            MODULES     : __dirname + '/../../src/modules',
            ASSETS      : __dirname + '/../../src/assets',
            CNT_PRIVATE : __dirname + '/../../src/content',
            CNT_GLOBAL  : __dirname + '/../../src/content/_global'   
        }

        mkdirp(this.DIRS.COMPILED, function(err: any) { });

        // Register Template Engine
        this.tmpEngine = prmsHBars(require('handlebars'), { 
            Promise: Q.Promise
        });

        // Serve Static Files
        this.xprApp.use(express.static(this.DIRS.COMPILED));

        // Run
        this.run();
    }

    /**
     * Function will provide forEach async
     * @param array 
     * @param callback 
     */
    async asyncForEach(array: any, callback: any) {
        for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array)
        }
    }

    /**
     * PREPARE SHARED CONTENT
     * Function will load content files from _shared folder
     * and append them in order to create a larger yaml
     */
    async prepareGlobalContent() {
        const files      = fs.readdirSync(this.DIRS.CNT_GLOBAL);
        let combinedYAML = '';

        await this.asyncForEach(files, async (file: string) => {
            combinedYAML += fs.readFileSync(this.DIRS.CNT_GLOBAL + '/'+ file, 'utf8') + '\n';
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
    async contentLoader(initialDir: string, currentDir: string = '', routeList: any = {}) {
        currentDir  = currentDir || initialDir;
        const files = fs.readdirSync(currentDir);

        // Run through files of current directory
        await this.asyncForEach(files, async (file: string) => {
            // Don't process global content
            if (file === '_global') {
                return;
            }

            // Process regular files & folders
            if (fs.statSync(currentDir + '/' + file).isDirectory()) {
                routeList = this.contentLoader(initialDir, currentDir + '/' + file + '/', routeList);
                
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
    async moduleLoader(currentDir: string, moduleList: any = {}) {
        const files = fs.readdirSync(currentDir);

        // Run through files of current directory
        await this.asyncForEach(files, async (file: string) => {
            if (fs.statSync(currentDir + '/' + file).isDirectory()) {
                moduleList = await this.moduleLoader(currentDir + '/' + file, moduleList);
            } else {            
                const [moduleName, extension] = file.split('.');

                // Register templates
                if(extension == 'hbs') {
                    this.tmpEngine.registerPartial(moduleName, fs.readFileSync(currentDir + '/' + file, 'utf8'));
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
    async assignController(moduleName: any, data: any) {
        const moduleConstructor = pascalCase(moduleName + ' Module'); 

        data = data || {};

        if(this.MODULES[moduleName] && this.MODULES[moduleName][moduleConstructor]) {
            const serviceInstance = new this.MODULES[moduleName][moduleConstructor](this.xprContext.req, this.xprContext.res, data);
            
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
    async renderTemplate(moduleName: string, data: any) { 
        let template:any;
        let html:any;
        let compData: any;

        data = data || {};

        // Propagate Data to Partials
        if (this.GLOBAL) {
            data.global = this.GLOBAL;
        }
        if (this.ROUTES) {
            data.routes = this.ROUTES;
        }

        // Render partial or fallback (if module is missing)
        if(this.tmpEngine) {
            if(this.tmpEngine.partials && this.tmpEngine.partials[moduleName]) {
                template = await this.tmpEngine.compile(this.tmpEngine.partials[moduleName], {noEscape:true});
                compData = await this.assignController(moduleName, data);
                html     = await template(compData);
            } else {
                template = await this.tmpEngine.compile(this.tmpEngine.partials['_missingModule'], {noEscape:true});
                html     = await template({data: {missingModule: moduleName}});
            }

            return new this.tmpEngine.SafeString(html).toHTML();
        }

        return "ERROR: Template Engine Compromised.";
    }

    /**
     * REGISTER ROUTES
     * Function will register the routes on the app
     * and render the corresponding templates on call
     */
    async registerRoutes() {
        Object.keys(this.ROUTES).forEach((routePath: any) => {
            const objContent = this.ROUTES[routePath];
        
            this.xprApp.all(routePath, async (req: any, res: any, next: any) => {
                this.xprContext.req = req;
                this.xprContext.res = res;
                const objClone      = JSON.parse(JSON.stringify(objContent));

                if(objClone.settings && objClone.settings.template) {                    
                    const rndContent = await this.renderTemplate('core', objClone);

                    res.send(rndContent);
                }
            });
        });
    }

    /**
     * PREPARE TEMPLATE ENGINE
     * Function will prepare the template engine
     */
    prepareTemplateEngine() {
        this.tmpEngine.registerPartial('_missingModule', '<br><span style="color: red;">Module "{{data.missingModule}}" cannot be found!</span>');
        this.tmpEngine.registerHelper('include', (moduleName: string, data: any) => this.renderTemplate(moduleName, data));
    }

    /**
     * COPY VENDOR ASSETS
     * Function will copy any vendor assets to static folder
     */
    async copyVendor() {
        ncp.limit = 16;
        ncp(this.DIRS.ASSETS + '/vendor', this.DIRS.COMPILED + '/vendor', () => {});
    }

    /**
     * COPY MEDIA ASSETS
     * Function will copy any media assets to static folder
     */
    async copyMedia() {
        ncp.limit = 16;
        ncp(this.DIRS.ASSETS + '/media', this.DIRS.COMPILED + '/media', () => {});
    }

    /**
     * RENDER CSS
     * Function will render the CSS from given SASS
     */
    async renderCSS() {
        mkdirp(this.DIRS.COMPILED + '/styles', function(err: any) { });
        
        await sass.render({
            file       : this.DIRS.ASSETS + '/styles/main.scss',
            outFile    : this.DIRS.COMPILED + '/styles/main.css',
            outputStyle: 'compressed'
        }, (err: any, result: any) => {
            if(!err) {
                fs.writeFileSync(this.DIRS.COMPILED + '/styles/main.css', result.css, 'utf8');
            }
        });
    }

    /**
     * RENDER TS
     * Function will render the Frontend TS to JavaScript
     */
    async renderTS() {
        const content         = fs.readFileSync(this.DIRS.ASSETS + '/scripts/main.ts', 'utf8');
        const compilerOptions = { module: typescript.ModuleKind.System };

        mkdirp(this.DIRS.COMPILED + '/scripts', function(err: any) { });

        // Process
        const transpiled = typescript.transpile(content, compilerOptions, undefined, undefined, 'main');
        fs.writeFileSync(this.DIRS.COMPILED + '/scripts/main.js', transpiled, 'utf8');

        // Minify
        await minify(this.DIRS.COMPILED + '/scripts/main.js', (err: any, minified: any) => {
            if(!err) {
                fs.writeFileSync(this.DIRS.COMPILED + '/scripts/main.js', minified, 'utf8');
            }
        });
    }

    /**
     * RUN
     */
    async run() {
        // Assets
        console.log('[eirene] Copying Assets ...');
        await this.copyVendor();
        await this.copyMedia();

        // Asset Compilation
        console.log('[eirene] Compiling CSS/TS ...');
        await this.renderCSS();
        await this.renderTS();

        // Template Engine
        console.log('[eirene] Registering Template Engine ...');
        this.prepareTemplateEngine();
        
        // Load Modules & Routes
        console.log('[eirene] Loading Modules & Content ...');
        this.GLOBAL  = await this.prepareGlobalContent();
        this.MODULES = await this.moduleLoader(this.DIRS.MODULES);
        this.ROUTES  = await this.contentLoader(this.DIRS.CNT_PRIVATE);

        // Register Routes
        console.log('[eirene] Registering Routes ...');
        await this.registerRoutes();
    }

}