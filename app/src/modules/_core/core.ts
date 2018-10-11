/**
 * eirene :: Content Management System
 * -----------------------------------
 * Copyright (c) 2018 CUREON
 * @License MIT
 */

/**
 * CoreModule
 */
export class CoreModule {
    /**
     * Constructor
     */
    constructor(
        private req: any,
        private res: any,
        private data: any = {}
    ) { }

    /**
     * Compile
     */
    async compile() {
        return this.data; 
    }
}