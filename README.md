![alt text](https://raw.githubusercontent.com/SharkeyO/eirene-core/master/eireneCMS.png)

__eirine__ is a flat-file, nodejs-based Content Management System (CMS) that is developed and maintained as open-source project. Powered by Express.js with TypeScript.

## Setup & start

- Install npm dependencies `npm i`
- Start eirene `npm run eirene`

## Features

- Express.js core written in TypeScript
- Content files written in YAML
- Routes automatically recognized from pages-folder structure
- Shared content separated
- Handlebars templates
- Component based approach && page-based approach both possible
- Components include templates and optional controllers
- SASS styling

## TODO:

- Global/Shared Content
- Update example project
- Add user/roles & auth-extensions
- Add futher template engines
- Add JS bundler for frontend
- Add admin-panel as Component (maybe own repo)
- Setup npm package install method
- Create repos for extensions

## Add components

- Add .hbs file to component folder
- Optional add .ts file as controller (named like .hbs)
- e.g `slider.hbs` /w `slider.ts`
- Controller holds a class named `SliderComponent`
- Controller class holds a function called `compile`
- Controller is cunstructed with Express `req & res` and the data object given as include param