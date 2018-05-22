import * as Koa from 'koa';
import * as Router from 'koa-router';
import * as serve from 'koa-static';
import * as views from 'koa-views';
import * as fs from 'fs';
import * as path from 'path';
import * as showdown from 'showdown';

// Instantiate APP
const app       = new Koa();
const router    = new Router();
const converter = new showdown.Converter();

// Serve static content from static folder
app.use(serve(__dirname + '/static'));

// Must be used before any router is used
app.use(views(__dirname + '/templates', {
    extension: 'pug',
    map: {
        pug: 'pug',
    },
}));

// Create routes by content
fs.readdir(__dirname + '/content', function(err, items) { 
    items.forEach((item) => {
        const route = item.split('.', 1)[0];

        router.get('/' + route, async (ctx) => {
            const fPath = path.join(__dirname, './content/' + item);
            const objContent = await renderContent(fPath) 
            
            await ctx.render('home', objContent);
        });
    });
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
                        .split('----')
                        .forEach((pair) => {
                            const index   = pair.indexOf(': ');
                            const arrPair = [pair.slice(0, index).trim(), pair.slice(index + 1).trim()];
                            
                            if(arrPair[0] && arrPair[1]) {
                                objData[arrPair[0]] = converter.makeHtml(arrPair[1]);
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