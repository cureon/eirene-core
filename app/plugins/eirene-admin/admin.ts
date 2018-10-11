export class AdminPlugin {
    constructor(expApp: any) {
        
        expApp.all('/admin', async (req: any, res: any, next: any) => {
            res.send('Happy Birthday To Me');
        });
        
        this.run();
    }

    run() {
        console.log('Happy Birthday');
    }
}