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
WebNovel/
├── .angular/              # Angular cache and build files
├── Services/              # Backend service integrations
├── src/                   # Source code
│   ├── app/               # Application code
│   │   ├── components/    # Reusable UI components
│   │   │   ├── age-verification-modal/  # Age verification popup
│   │   │   ├── age-verification-wrapper/ # Age verification container
│   │   │   ├── chapter-comments/        # Chapter discussion section
│   │   │   ├── novel-card/              # Novel preview card
│   │   │   └── novel-comments/          # Novel reviews section
│   │   │
│   │   ├── models/        # TypeScript interfaces and data models
│   │   │
│   │   ├── pages/         # Application pages/routes
│   │   │   ├── auth/      # Authentication pages
│   │   │   │   ├── auth-layout/         # Authentication page layout
│   │   │   │   ├── complete-profile/    # Profile completion
│   │   │   │   ├── google-callback/     # Google OAuth handler
│   │   │   │   ├── login/               # User login
│   │   │   │   ├── oauth-callback/      # General OAuth handler
│   │   │   │   ├── register/            # User registration
│   │   │   │   └── verify/              # Account verification
│   │   │   │
│   │   │   ├── browse/                  # Novel browsing page
│   │   │   ├── complete-registration/   # Registration completion
│   │   │   ├── create/                  # Content creation hub
│   │   │   ├── home/                    # Homepage
│   │   │   ├── library/                 # User's reading library
│   │   │   ├── my-novels/               # Author's novels management
│   │   │   ├── novel-create/            # Novel creation workflow
│   │   │   ├── novel-detail/            # Novel information page
│   │   │   ├── profile/                 # User profile page
│   │   │   ├── rankings/                # Novel rankings page
│   │   │   ├── read/                    # Novel reading interface
│   │   │   └── search/                  # Search results page
│   │   │
│   │   ├── services/      # API communication and data services
│   │   │
│   │   └── shared/        # Shared components
│   │       ├── footer/    # Application footer
│   │       ├── navbar/    # Navigation header
│   │       ├── search-modal/ # Search popup
│   │       └── star-rating/  # Rating component
│   │
│   ├── assets/            # Static assets
│   │   ├── images/        # General images
│   │   ├── novel-covers/  # Novel cover images
│   │   └── profiles/      # User profile images
│   │
│   └── environments/      # Environment configuration
│
├── angular.json           # Angular configuration
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
└── other config files     # Various configuration files
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
- [API Documentation](#) 

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
