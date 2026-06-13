# Mobile UI Design Prompt for Lab R&D Operating System

## Project Context

We are building a hybrid distributed lab management system where:
- **PC (Thick Client/Server)**: Full-featured lab management with complete CRUD operations, AI analysis, file uploads, complex workflows
- **Mobile (Thin Client/Data Access)**: Lightweight data access point for viewing, searching, and basic operations while on-the-go

The mobile app should serve as a companion to the PC version, allowing researchers to:
- View project status and experiment results remotely
- Search and access lab resources
- Perform quick status updates
- Receive notifications about important changes
- Access knowledge vault documents

## Current Desktop UI Analysis

### Design Language
- **Theme**: Premium dark/light theme with orange accent (#ff6b35)
- **Layout**: Left sidebar navigation + main content area
- **Typography**: System fonts (Inter, Segoe UI, Roboto)
- **Color Palette**:
  - Primary: Dark grays (#1a1a1a, #242424, #2d2d2d)
  - Text: Light grays (#e0e0e0, #a0a0a0, #707070)
  - Accent: Orange (#ff6b35) with hover states
  - Status colors: Green (success), Yellow (warning), Red (error), Blue (info)

### Navigation Structure
- **Main**: Dashboard, Projects, Notebook, Experiments
- **Resources**: Resources (knowledge vault), Findings
- **Tools**: Toolbox, Inventory, Usage Logs
- **Settings**: Settings

### Key UI Components
- Sidebar with collapsible sections
- Card-based content layout
- Data tables with sorting/filtering
- Modal dialogs for forms
- Status badges and indicators
- Search functionality
- Theme toggle (dark/light)

## Mobile UI Requirements

### Design Principles
1. **Mobile-First**: Optimize for touch interactions, thumb-friendly navigation
2. **Data Access Focus**: Prioritize viewing and searching over complex editing
3. **Progressive Disclosure**: Show essential info first, details on demand
4. **Offline-First**: Cache data for offline viewing, sync when online
5. **Performance**: Fast loading, minimal data transfer

### Screen Layout

#### Bottom Navigation Bar (Primary)
- 5-tab bottom navigation for easy thumb access
- Icons: Dashboard, Projects, Experiments, Resources, Profile
- Active state with orange accent
- Badge notifications for updates

#### Top Bar (Secondary)
- Hamburger menu for additional options
- Search bar (expandable)
- Sync status indicator (online/offline)
- Theme toggle

#### Content Area
- Card-based layout optimized for vertical scrolling
- Swipe gestures for quick actions
- Pull-to-refresh for data sync
- Infinite scroll for large lists

### Key Screens & Features

#### 1. Dashboard (Home)
- **Quick Stats**: Active projects, pending experiments, equipment status
- **Recent Activity**: Timeline of recent changes (synced from PC)
- **Quick Actions**: New experiment, update status, search
- **Notifications**: Important alerts and reminders

#### 2. Projects List
- **Card Layout**: Project name, status, progress, last updated
- **Filter/Sort**: By status, date, priority
- **Search**: Full-text search across projects
- **Actions**: View details, mark as complete, add note
- **Swipe Actions**: Left swipe to archive, right swipe to edit

#### 3. Project Detail View
- **Header**: Project name, status, progress bar
- **Tabs**: Overview, Experiments, Notes, Timeline
- **Overview**: Description, team members, dates
- **Experiments**: List with status badges
- **Notes**: Quick view of recent notes
- **Actions**: Add note, update status, share

#### 4. Experiments List
- **Card Layout**: Experiment title, status, project, date
- **Status Indicators**: PENDING, PASS, FAIL with color coding
- **Filter**: By status, project, date range
- **Search**: Full-text search
- **Quick View**: Tap to see summary without full detail

#### 5. Experiment Detail View
- **Header**: Title, status, project
- **Sections**: Expected outcome, actual outcome, findings, conclusion
- **Attachments**: View/download files (read-only on mobile)
- **Timeline**: Stage progress
- **Actions**: Update status, add finding, add conclusion

#### 6. Resources (Knowledge Vault)
- **Grid/List Toggle**: Visual or list view
- **Categories**: Documents, datasheets, images
- **Search**: Full-text search with filters
- **Preview**: Quick preview of documents
- **Download**: Download for offline viewing

#### 7. Findings
- **Card Layout**: Title, severity, status, project
- **Severity Indicators**: High (red), Medium (yellow), Low (green)
- **Filter**: By severity, status, project
- **Actions**: View details, mark as resolved, add comment

#### 8. Inventory (Equipment/Components)
- **List View**: Name, status, location, quantity
- **Search**: By name, location, status
- **Quick Actions**: Check in/out, update status
- **Barcode Scan**: For quick inventory lookup

#### 9. Settings
- **Sync Settings**: Manual/auto sync, sync interval
- **Theme**: Dark/light mode
- **Notifications**: Push notification preferences
- **Account**: User profile, logout
- **About**: App version, help

### Mobile-Specific Interactions

#### Gestures
- **Pull to refresh**: Sync data from server
- **Swipe left/right**: Quick actions (archive, edit, delete)
- **Long press**: Context menu
- **Pinch to zoom**: Image/document preview

#### Navigation Patterns
- **Bottom sheet**: For quick actions and selections
- **Modal dialogs**: For forms and confirmations
- **Slide-over panels**: For detailed views without full navigation
- **Tab bars**: For organizing related content

#### Offline Support
- **Cached data**: Store frequently accessed data locally
- **Offline indicators**: Show sync status in UI
- **Queue actions**: Queue updates when offline, sync when online
- **Conflict resolution**: Show conflicts when syncing

### Technical Considerations

#### Responsive Design
- Breakpoints: Mobile (<768px), Tablet (768-1024px), Desktop (>1024px)
- Use CSS Grid/Flexbox for adaptive layouts
- Touch-friendly tap targets (minimum 44x44px)
- Keyboard-safe areas for mobile browsers

#### Performance
- Lazy loading for images and long lists
- Virtual scrolling for large datasets
- Optimized images (WebP format, compression)
- Minimal JavaScript bundle size
- Service worker for offline caching

#### Accessibility
- Semantic HTML elements
- ARIA labels for screen readers
- High contrast ratios (WCAG AA compliant)
- Keyboard navigation support
- Voice control compatibility

### Design Deliverables

1. **Wireframes**: Low-fidelity sketches for each screen
2. **Mockups**: High-fidelity visual designs with current theme
3. **Component Library**: Reusable mobile UI components
4. **Interaction Flows**: User journey maps for key tasks
5. **Style Guide**: Mobile-specific design tokens and guidelines

### Success Metrics

- Fast load time (<3 seconds on 3G)
- High task completion rate for common actions
- Positive user feedback on usability
- Low error rate in sync operations
- High engagement with offline features

## Next Steps

Please start by:
1. Creating wireframes for the 5 main screens (Dashboard, Projects, Experiments, Resources, Settings)
2. Defining the mobile component library based on current desktop components
3. Outlining the information architecture for mobile-optimized navigation
4. Proposing a design system that maintains consistency with the desktop UI while optimizing for mobile use cases

Focus on the data access use case: researchers need to quickly find information, check status, and perform simple updates while away from their PC.
