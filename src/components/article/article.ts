import * as MarkdownIt from 'markdown-it';

// Prerequisites
const converter = new MarkdownIt();

/**
 * ArticleComponent
 */
export class ArticleComponent {
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
        if(this.data.text) {
            this.data.text = converter.render(this.data.text);
        }
        return this.data; 
    }
}