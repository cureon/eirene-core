import * as showdown from 'showdown';

// Prerequisites
const converter = new showdown.Converter();

// Pipe Code
export function markdown(data: any) {
    return converter.makeHtml(data);
}