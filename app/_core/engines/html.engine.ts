/**
 * eirene :: Content Management System
 * -----------------------------------
 * Copyright (c) 2018 CUREON
 * @License MIT
 */

/**
 * Prereqisites
 */
import * as path from 'path';
import * as Q from 'q';
import * as sass from 'node-sass';
import * as typescript from 'typescript';
import * as fs from 'fs';

const prmsHBars  = require('promised-handlebars');
const ncp        = require('ncp').ncp;
const mkdirp     = require('mkdirp');
const minify     = require('minify');
const pascalCase = require('pascal-case');

/**
 * eirene :: HTML Engine Class
 *
 * @export
 * @class HTMLEngineClass
 */
export class HTMLEngine {
  /**
   * Members
   */
  protected tmpEngine: any;

  /**
   * Constructor
   */
  constructor(protected config: any) {
    // Register Template Engine
    this.tmpEngine = prmsHBars(require('handlebars'), {
      Promise: Q.Promise
    });

    if (this.tmpEngine) {
      this.prepareTemplateEngine();
    }
  }

  /**
   * PREPARE TEMPLATE ENGINE
   * Function will prepare the template engine
   */
  prepareTemplateEngine() {
    this.tmpEngine.registerPartial('_missingModule', '<br><span style="color: red;">Module "{{data.missingModule}}" cannot be found!</span>');
    this.tmpEngine.registerHelper('include', (moduleName: string, data: any) => this.renderTemplate(moduleName, data));
  }

  registerPartial(moduleName: string, templateContent: string) {
    this.tmpEngine.registerPartial(moduleName, templateContent);
  }

  /**
   * COPY VENDOR ASSETS
   * Function will copy any vendor assets to static folder
   */
  async copyVendor(vendorDir: string) {
    try {
      ncp.limit = 16;
      ncp(vendorDir, path.join(this.config.DIRS.COMPILED, 'vendor'), () => {});
    } catch(e) {
      throw new Error(`Copy Vendor Error: ${e.message}`);
    }
  }

  /**
   * COPY MEDIA ASSETS
   * Function will copy any media assets to static folder
   */
  async copyMedia(mediaDir: string) {
    try {
      ncp.limit = 16;
      ncp(mediaDir, path.join(this.config.DIRS.COMPILED, 'media'), () => {});
    } catch(e) {
      throw new Error(`Copy Media Error: ${e.message}`);
    }
  }

  /**
   * COMPILE SASS/SCSS
   * Function will render the CSS from given SASS
   */
  async compileSASS(stylesDir: string) {
    try {
      mkdirp(path.join(this.config.DIRS.COMPILED, 'styles'), function(err: any) { });

      await sass.render({
        file       : path.join(stylesDir, 'main.scss'),
        outFile    : path.join(this.config.DIRS.COMPILED, 'styles', 'main.css'),
        outputStyle: 'compressed'
      }, (err: any, result: any) => {
        if(!err) {
          fs.writeFileSync(path.join(this.config.DIRS.COMPILED, 'styles', 'main.css'), result.css, 'utf8');
        }
      });
    } catch(e) {
      throw new Error(`CSS Render Error: ${e.message}`);
    }
  }

  /**
   * COMPILE TS
   * Function will render the Frontend TS to JavaScript
   */
  async compileTypeScript(scriptsDir: string) {
    try {
      const content         = fs.readFileSync(path.join(scriptsDir, 'main.ts'), 'utf8');
      const compilerOptions = { module: typescript.ModuleKind.System };

      mkdirp(path.join(this.config.DIRS.COMPILED, 'scripts'), function(err: any) { });

      // Process
      const transpiled = typescript.transpile(content, compilerOptions, undefined, undefined, 'main');
      fs.writeFileSync(path.join(this.config.DIRS.COMPILED, 'scripts', 'main.js'), transpiled, 'utf8');

      // Minify
      await minify(path.join(this.config.DIRS.COMPILED, 'scripts', 'main.js'), (err: any, minified: any) => {
        if(!err) {
          fs.writeFileSync(path.join(this.config.DIRS.COMPILED, 'scripts', 'main.js'), minified, 'utf8');
        }
      });
    } catch(e) {
      throw new Error(`Script Render Error: ${e.message}`);
    }
  }

  /**
   * ASSIGN CONTROLLER
   * Function will assign a controller to a module in order
   * to compile the data the module needs to provide to the UI
   * @param moduleName
   * @param data
   */
  async assignController(moduleName: any, objData: any = {}, xprContext: any = {}) {
    if(this.config.PLUGIN_MODULES[moduleName]) {
      const moduleConstructor = pascalCase(moduleName + ' Module');
      const ModuleAbstract    = this.config.PLUGIN_MODULES[moduleName][moduleConstructor];
      const moduleInstance    = ModuleAbstract ? new ModuleAbstract(xprContext.req, xprContext.res, objData) : {};

      if(moduleInstance.compile && typeof moduleInstance.compile == 'function') {
        objData = await moduleInstance.compile();
      }
    }

    return objData;
  }

  /**
   * RENDER TEMPLATE
   * Function will render any given partial & data to HTML
   * @param modulePartial
   * @param context
   */
  async renderTemplate(modulePartial: string, objData: any = {}, xprContext: any = {}) {
    let template:any;
    let html:any;
    let compData: any;

    // Propagate Data to Partials
    if (this.config.SHARED_CONTENT) {
      objData.global = this.config.SHARED_CONTENT;
    }

    // Render partial or fallback (if module is missing)
    if(this.tmpEngine) {
      if(this.tmpEngine.partials && this.tmpEngine.partials[modulePartial]) {
        template = await this.tmpEngine.compile(this.tmpEngine.partials[modulePartial], {noEscape:true});
        compData = await this.assignController(modulePartial, objData, xprContext);
        html     = await template(compData);
      } else {
        template = await this.tmpEngine.compile(this.tmpEngine.partials['_missingModule'], {noEscape:true});
        html     = await template({data: {missingModule: modulePartial}});
      }

      return new this.tmpEngine.SafeString(html).toHTML();
    }

    return "ERROR: Template Engine Compromised.";
  }

  /**
   * Function will start the engine and perform
   * prerequisites
   */
  async startEngine() {
    // Assets
    console.log('[eirene-html] Copying Assets ...');
    await this.copyVendor(this.config.DIRS.VENDOR);
    await this.copyMedia(this.config.DIRS.MEDIA);

    // Asset Compilation
    console.log('[eirene-html] Compiling CSS/TS ...');
    await this.compileSASS(this.config.DIRS.STYLES);
    await this.compileTypeScript(this.config.DIRS.SCRIPTS);
  }
}