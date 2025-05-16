# WebNovel Platform

## Table of Contents
- [Overview](#overview)
- [Technologies](#technologies)
- [Installation](#installation)
- [Environment Configuration](#environment-configuration)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [Features](#features)
- [Documentation](#documentation)
- [Roadmap](#roadmap)
- [Authors and License](#authors-and-license)

## Overview
WebNovel is a comprehensive platform for reading, writing, and sharing web novels. The application provides an intuitive interface for authors to publish their work and for readers to discover and enjoy new stories.

## Technologies
- **Framework**: Angular 16.2.16
- **Language**: TypeScript
- **Styling**: SCSS
- **Authentication**: OAuth integration with multiple providers
- **State Management**: Angular services and RxJS
- **UI Components**: Custom-built components with responsive design
- **API Communication**: Angular HttpClient

## Installation
1. Clone the repository:
```bash
git clone https://github.com/yourusername/WebNovel.git
cd WebNovel
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

4. Navigate to `http://localhost:4200/` in your browser

## Environment Configuration
Create an `environment.ts` file in the `src/environments` directory:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  oauthClientId: 'your-oauth-client-id',
  // Add other environment variables as needed
};
```

## Available Scripts
- `npm start` - Starts the development server
- `npm run build` - Builds the application for production
- `npm run watch` - Builds and watches for changes
- `npm test` - Runs unit tests
- `npm run lint` - Lints the codebase
- `npm run e2e` - Runs end-to-end tests

## Project Structure
```
src/
├── app/
│   ├── components/       # Reusable UI components
│   ├── models/           # TypeScript interfaces and models
│   ├── pages/            # Application pages/routes
│   │   ├── auth/         # Authentication pages
│   │   ├── browse/       # Novel browsing
│   │   ├── create/       # Novel creation
│   │   ├── read/         # Novel reading
│   │   └── ...
│   ├── services/         # API and state management services
│   └── shared/           # Shared components (navbar, footer)
├── assets/               # Static assets
│   ├── images/           # General images
│   ├── novel-covers/     # Novel cover images
│   └── profiles/         # User profile images
└── environments/         # Environment configuration
```

## Features
- **User Authentication**: Secure login/signup with OAuth integration
- **Novel Creation**: Rich editor for authors to write and publish novels
- **Reading Experience**: Customizable reading interface with progress tracking
- **Social Features**: Comments, ratings, and reviews
- **Personal Library**: Save favorite novels and track reading progress
- **Discover**: Browse trending novels, rankings, and personalized recommendations
- **User Profiles**: Customizable profiles for readers and authors
- **Age Verification**: Content filtering based on user age

## Documentation
- [Angular Documentation](https://angular.io/docs)
- [API Documentation](#) <!-- Replace with your API docs link if available -->

## Roadmap
- [ ] Offline reading capability
- [ ] Audio version of novels
- [ ] Subscription model for premium content
- [ ] Mobile application
- [ ] Enhanced analytics for authors
- [ ] Multi-language support
- [ ] Dark mode

## Authors and License
Developed by [Your Name/Team]

This project is licensed under the MIT License - see the LICENSE file for details.
