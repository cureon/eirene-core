/**
 * eirene :: Content Management System
 * -----------------------------------
 * Copyright (c) 2018 CUREON
 * @License MIT
 */

/**
 * NavigationModule
 */
export class NavigationModule {
    /**
     * Constructor
     */
    constructor(
        private req: any,
        private res: any,
        private data: any = {}
    ) {}

    /**
     * Compile
     */
    async compile() {
        const arrData: any[] = [];
        const objRoutes: any = this.data.routes;
        
        Object.keys(this.data.routes).forEach((key) => {
            const index = objRoutes[key].settings.index;
            arrData[index]          = {};
            arrData[index]['title'] = objRoutes[key].settings.title;
            arrData[index]['href']  = key;
        });

        this.data.navigation = arrData;

        return this.data;
    }
}