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
import * as bodyParser from 'body-parser';

// Plugin Imports
import { EireneHTMLPlugin } from './plugins/eirene-html/eirene-html.plugin';

class Eirene {
    /**
     * Members
     */
    private xprApp: any;

    /**
     * Constructor
     */
    constructor(private port: number) { 
        // Register Express App
        this.xprApp = express();
        this.xprApp.use(bodyParser.urlencoded({ extended: false }));
        this.xprApp.use(bodyParser.json());
    }

    /**
     * RUN APPLICATION
     * Function will run the server
     */
    async run() {
        console.log('--- eirene CMS v0.2 ---');
        console.log('[eirene] Initialization started ...');

        // Run Plugins
        const eireneHTML = new EireneHTMLPlugin(this.xprApp);

        // Open Server
        this.xprApp.listen(this.port, () => {
            console.log('[eirene] Application running on port ' + this.port + ' ...');
        });
    }
}

// Run Server
const eireneCMS = new Eirene(30100);
eireneCMS.run();