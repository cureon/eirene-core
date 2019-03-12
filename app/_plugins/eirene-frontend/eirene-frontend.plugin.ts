/**
 * eirene :: Content Management System
 * -----------------------------------
 * Copyright (c) 2018 CUREON
 * @License MIT
 */

/**
 * Prereqisites
 */
import { HTMLEngine } from '../../_core/engines/html.engine';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

/**
 * eirene :: Basic HTML Frontend
 *
 * @export
 * @class EireneHTMLPlugin
 */
export class EireneFrontendPlugin {
  /**
   * Members
   */
  protected ENGINE: any;
  protected CONFIG: any;

  /**
   * Constructor
   */
  constructor(protected xprApp: any) {}

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
  async loadSharedContent() {
    const files      = fs.readdirSync(this.CONFIG.DIRS.CNT_SHARED);
    let combinedYAML = '';

    await this.asyncForEach(files, async (file: string) => {
      combinedYAML += fs.readFileSync(path.join(this.CONFIG.DIRS.CNT_SHARED, file), 'utf8') + '\n';
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
  async loadContent() {
    const objListContent: any    = {}
    const contentFiles: string[] = fs.readdirSync(this.CONFIG.DIRS.CNT_REG);

    // Run through files of current directory
    await this.asyncForEach(contentFiles, async (file: string) => {
      // Don't process global content or routes object
      if (file === '_shared' || file === '_routes.yaml') {
          return;
      }

      // Build Route Name
      const routeName = file.replace(/\.[^/.]+$/, '');

      // Return /w Content
      objListContent[routeName] = yaml.safeLoad(fs.readFileSync(path.join(this.CONFIG.DIRS.CNT_REG, file), 'utf8'));
    });

    return objListContent;
  };

  /**
   * COMPONENT LOADER
   * Function will scan a dir for modules and register templates
   * as well as corresponding controllers
   * @param currentDir
   * @param moduleList
   */
  async loadPluginModules() {
    const moduleDir: string = this.CONFIG.DIRS.PLUGIN_MODULES;
    const moduleList: any = {};
    const modulePaths = fs.readdirSync(moduleDir);

    await this.asyncForEach(modulePaths, async (modulePath: string) => {
      const moduleName     = modulePath.replace('_', '');
      const templateFile   = path.join(moduleDir, modulePath, (moduleName + '.hbs'));
      const controllerFile = path.join(moduleDir, modulePath, (moduleName + '.ts'));

      // Register Templates
      if (fs.existsSync(templateFile)) {
        this.ENGINE.registerPartial(moduleName, fs.readFileSync(templateFile, 'utf8'));

        // TODO: Implement global template handling
      }

      // Register COntrollers
      if (fs.existsSync(controllerFile)) {
        const moduleImport = await import(controllerFile);
        moduleList[moduleName] = moduleImport;
      }
    });

    return await moduleList;
  };

  /**
   * REGISTER ROUTES
   * Function will register the routes on the app
   * and render the corresponding templates on call
   */
  async registerRoutes() {
    const routesYAML: string = fs.readFileSync(path.join(this.CONFIG.DIRS.CNT_REG, '_routes.yaml'), 'utf8');
    const routesConfig: any  = yaml.safeLoad(routesYAML) || {};

    Object.keys(routesConfig).forEach((routePath: any) => {
      const strContent = fs.readFileSync(path.join(this.CONFIG.DIRS.CNT_REG, routesConfig[routePath] + '.yaml'), 'utf8');
      const objContent = yaml.safeLoad(strContent) || {};

      this.xprApp.all(routePath, async (req: any, res: any, next: any) => {
        const objClone   = JSON.parse(JSON.stringify(objContent));
        const rndContent = await this.ENGINE.renderTemplate('core', objClone, {req: req, res: res});

        res.send(rndContent);
      });
    });
  }

  async runPlugin() {
    // Prerequisites
    this.CONFIG = {
      DIRS : {
        COMPILED      : path.join(__dirname, '../../../_compiled/eirene-frontend'),
        VENDOR        : path.join(__dirname, '../../../workspace/vendor'),
        MEDIA         : path.join(__dirname, '../../../workspace/media'),
        STYLES        : path.join(__dirname, '../../../workspace/styles'),
        SCRIPTS       : path.join(__dirname, '../../../workspace/scripts'),
        CNT_REG       : path.join(__dirname, '../../../workspace/content'),
        CNT_SHARED    : path.join(__dirname, '../../../workspace/content/_shared'),
        PLUGIN_MODULES: path.join(__dirname, 'modules'),
      }
    };

    // Load Engine
    this.ENGINE = new HTMLEngine(this.CONFIG);

    // Loading Content & Modules
    console.log('[eirene-html] Loading Modules & Content ...');
    this.CONFIG['SHARED_CONTENT'] = await this.loadSharedContent();
    this.CONFIG['PLUGIN_MODULES'] = await this.loadPluginModules();

    // Render Routes /w given config
    console.log('[eirene-html] Registering Routes ...');
    await this.registerRoutes();
  }
}