# PadelAtHome Project Context

## Project Overview

**PadelAtHome** is a web application for managing bookings of Padel courts in a residential building (or similar community). It allows users to register, book courts, join open matches, and view availability. Administrators can manage users, courts, and view statistics.

### Tech Stack
- **Frontend:** HTML5, Tailwind CSS (via CDN), Vanilla JavaScript.
- **Backend:** Node.js with Express.
- **Database:** PostgreSQL.
- **Authentication:** JWT (JSON Web Tokens).

### Current UI Style
The application is undergoing a migration to a modern, clean UI using Tailwind CSS.
- **Primary Color:** Royal Blue (`#2563EB`, Tailwind `blue-600` / `primary-600`).
- **Font:** Inter (sans-serif).
- **Design Elements:** Rounded corners, soft shadows, centered cards for auth pages, responsive layouts.
- **Specific CSS:**
    - `public/style.css` contains some custom overrides and specific component styles (like the calendar) but is being phased out in favor of utility classes.
    - Tailwind configuration is injected in HTML files via the script tag to define the `primary` color palette.

### Common Tailwind Configuration
```html
<style>
/* Font Import */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

/* Base Styles */
body { font-family: 'Inter', sans-serif; background-color: #f8fafc; }

/* Utility Overrides/Customizations */
.text-primary-600 { color: #2563EB; }
.bg-primary-600 { background-color: #2563EB; }
.bg-primary-700 { background-color: #1d4ed8; }
.focus\:ring-primary-500:focus { --tw-ring-color: #3b82f6; }
.text-primary-600 { color: #2563EB; }
.hover\:text-primary-500:hover { color: #3b82f6; }
.border-primary-600 { border-color: #2563EB; }
.bg-primary-50 { background-color: #eff6ff; }
.bg-primary-100 { background-color: #dbeafe; }
.text-primary-800 { color: #1e40af; }
.text-primary-700 { color: #1d4ed8; }

/* Custom colors for badges based on Tailwind colors */
.badge-active { @apply bg-green-100 text-green-800; }
.badge-pending { @apply bg-yellow-100 text-yellow-800; }
.badge-inactive { @apply bg-red-100 text-red-800; }
.badge-role-admin { @apply bg-purple-100 text-purple-800; }
.badge-role-user { @apply bg-blue-100 text-blue-800; }

/* Custom button styles */
.btn-primary {
    @apply w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-200;
}

.btn-secondary {
    @apply w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-700 bg-primary-100 hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-200;
}

/* Form input styles */
.form-input {
    @apply appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-colors duration-200;
}

/* Card styles */
.card {
    @apply bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-slate-100;
}
</style>
<script>
    tailwind.config = {
        theme: {
            extend: {
                colors: {
                    primary: {
                        50: '#eff6ff',
                        100: '#dbeafe',
                        200: '#bfdbfe',
                        300: '#93c5fd',
                        400: '#60a5fa',
                        500: '#3b82f6',
                        600: '#2563EB',
                        700: '#1d4ed8',
                        800: '#1e40af',
                        900: '#1e3a8a',
                        950: '#172554',
                    }
                },
                fontFamily: {
                    sans: ['Inter', 'sans-serif'],
                }
            }
        }
    }
</script>
```

### Database Schema

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user', -- 'admin', 'user'
    account_status VARCHAR(50) DEFAULT 'pending_approval', -- 'active', 'pending_approval', 'inactive', 'rejected'
    phone_number VARCHAR(20),
    building VARCHAR(100), -- Tower/Building name
    apartment VARCHAR(50), -- Apartment number/ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE courts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50), -- 'padel', 'tennis'
    is_indoor BOOLEAN DEFAULT FALSE,
    location VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    court_id INTEGER REFERENCES courts(id),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'confirmed', -- 'confirmed', 'cancelled', 'completed'
    payment_status VARCHAR(50) DEFAULT 'pending', -- 'paid', 'pending', 'refunded'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE waiting_list_entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    court_id INTEGER REFERENCES courts(id),
    slot_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE blocked_periods (
    id SERIAL PRIMARY KEY,
    court_id INTEGER REFERENCES courts(id),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    reason VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE open_matches (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER REFERENCES bookings(id),
    target_players INTEGER DEFAULT 4,
    current_players INTEGER DEFAULT 1,
    level_min FLOAT,
    level_max FLOAT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE match_participants (
    id SERIAL PRIMARY KEY,
    open_match_id INTEGER REFERENCES open_matches(id),
    user_id INTEGER REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'joined', -- 'joined', 'withdrawn'
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Key Components

1.  **Backend (Node.js/Express):**
    *   `server.js`: Entry point. Sets up Express, database connection, middleware, and routes.
    *   `config/database.js`: Database configuration using `pg` (node-postgres).
    *   `controllers/`:
        *   `authController.js`: Registration, login, password reset.
        *   `bookingController.js`: Creating, cancelling, and viewing bookings.
        *   `scheduleController.js`: Retrieving availability and schedule data.
        *   `adminController.js`: User management, court management, stats.
        *   `waitingListController.js`: Managing waitlist entries.
    *   `routes/`: API routes corresponding to controllers.
    *   `middleware/`:
        *   `auth.js`: JWT verification and role-based access control.

2.  **Frontend (Vanilla JS + Tailwind CSS):**
    *   `public/index.html`: Landing page (redirects to login/dashboard).
    *   `public/login.html`, `register.html`: Auth pages.
    *   `public/dashboard.html`: Main user interface.
    *   `public/admin.html`: Admin interface.
    *   `public/js/`:
        *   `dashboard.js`: Main logic for the user dashboard.
        *   `admin.js`: Logic for the admin panel.
        *   `services/api.js`: Wrapper for API calls (fetch).
        *   `components/Calendar.js`: Renders the schedule grid.
        *   `ui/modals.js`: Handles modal dialogs.

### Changelog

- **[2024-05-21] Initial Context Setup:** Document created to track project state.
- **[2024-05-21] Database Schema Update:** Added `waiting_list_entries` table.
- **[2024-05-21] UI Update:** Refactored `public/dashboard.html` and `public/admin.html` to use Tailwind CSS.
- **[2024-05-22] Auth UI Update:** Refactored `login.html`, `register.html`, `reset-password.html`, and `confirm-booking.html` to match the new Tailwind CSS design system (Royal Blue theme, centered card layout). Fixed regression in `register.html` where `phone_number` field was missing.
