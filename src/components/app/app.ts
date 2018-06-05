/**
 * AppComponent
 */
export class AppComponent {
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
        console.log('APP IS RUNNING');
        return this.data; 
    }
}