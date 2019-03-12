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
import { EireneFrontendPlugin } from './_plugins/eirene-frontend/eirene-frontend.plugin';

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

        // Serve Static Files
        this.xprApp.use(express.static(__dirname + '/_compiled'));
    }

    /**
     * RUN APPLICATION
     * Function will run the server
     */
    async run() {
        // Load Plugins
        const eireneFrontend = new EireneFrontendPlugin(this.xprApp);

        // Start
        console.log('--- eirene CMS v0.2 ---');
        console.log('[eirene-core] Initialization started ...');

        // Run Plugins
        await eireneFrontend.runPlugin();

        // Open Server
        this.xprApp.listen(this.port, () => {
            console.log('[eirene-core] Application running on port ' + this.port + ' ...');
        });
    }
}

// Run Server
const eireneCMS = new Eirene(30100);
eireneCMS.run();