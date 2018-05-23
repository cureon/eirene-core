import * as Koa from 'koa';
import * as Router from 'koa-router';
import * as serve from 'koa-static';
import * as views from 'koa-views';
import * as fs from 'fs';
import * as path from 'path';
import * as showdown from 'showdown';

// Instantiate APP
const app            = new Koa();
const router         = new Router();
const converter      = new showdown.Converter();

const staticFolder   = __dirname + '/static';
const configFile     = __dirname + '/config/config.json';
const contentFolder  = __dirname + '/content';
const templateFolder = __dirname + '/templates';

// Load config
const config = JSON.parse(fs.readFileSync(configFile).toString());

// Serve static content from static folder
app.use(serve(staticFolder));

// Register Template Engine
app.use(views(templateFolder, {
    extension: 'pug',
    options: {
        filters: {
            content: function (block: any) {
                return 'some string';
            }
        }
    },
    map: { pug: 'pug' }
}));

// Prepare routes
Object.keys(config.pages).forEach((key) => {
    const routeConfig = config.pages[key];
    
    if (routeConfig.content && routeConfig.template) {
        router.get('/' + (routeConfig.content == 'index' ? '' : routeConfig.content), async (ctx) => {
            const fPath           = contentFolder + '/' + routeConfig.content + '.txt';
            const objContent: any = await renderContent(fPath);

            await ctx.render(routeConfig.template, objContent);
        });
    }
});

/**
 * Function will render content by given file
 * @param file
 */
function renderContent(file: any) {
    return new Promise((resolve, reject) => {
        fs.readFile(file, 'utf8', (err, data) => {
            if (err) {
                reject(err);
            } else {
                let objData: any = {};

                if(data) {
                    data
                        .split('---')
                        .forEach((pair) => {
                            const index   = pair.indexOf(': ');
                            const arrPair = [pair.slice(0, index).trim(), pair.slice(index + 1).trim()];
                            const arrKey  = arrPair[0].split('|');
                            const key     = arrKey[0];
                            const pipe    = arrKey[1];
                            const value   = arrPair[1];
                            
                            if (key && value) {
                                if (pipe) {
                                    // TODO: Import external functions and filters
                                    console.log('PIPE CALLED');
                                } else {
                                    objData[key] = value;
                                }                                
                            }
                        }); 
                }    
                resolve(objData);
            }
        });
    });
}

app.use(router.routes());

// RUN
app.listen(3000);