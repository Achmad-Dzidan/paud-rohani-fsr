# PAUD Rohani - School Administration System

PAUD Rohani FSR is a comprehensive, web-based administration system designed for early childhood education institutions. Built with React and Firebase, it provides a centralized platform for managing school finances, student data, attendance, and academic assessments.

## Features

-   **Role-Based Access Control**: Secure login system with distinct roles and permissions for Admins, Teachers, and Users/Parents.
-   **Financial Dashboard**: An at-a-glance overview of key financial metrics, including total cash-on-hand (Brankas), total student savings, and net school revenue. Features an interactive chart visualizing daily revenue streams.
-   **Transaction Center**: Centralized data entry for all financial activities:
    -   **Student Income**: Record daily payments from students, which automatically updates their savings and marks their attendance.
    -   **Event Payments**: Manage payments for school events, with options for cash payment or deduction from a student's savings.
    -   **Operational Costs**: Log other school-related income and expenses, such as government grants (BOS), supply purchases, and utility bills.
-   **Daily Transaction Flow**: A detailed, chronological log of all income and expenses, grouped by date for easy monitoring and auditing.
-   **Student & Account Management**:
    -   **Student Profiles**: A complete CRUD (Create, Read, Update, Delete) interface for managing detailed student biodata, including personal information, family data, and profile photos.
    -   **User Accounts**: Manage login accounts for staff and parents, with the ability to assign roles and permissions.
-   **Attendance Matrix**: An intuitive grid-based system for tracking and managing weekly student attendance. Statuses like 'Hadir' (Present) are automatically updated when daily income is recorded.
-   **Digital Student Reports (Raport)**: A dynamic form for creating and managing student academic reports. Teachers can input narrative assessments and upload multiple documentary photos for each student. The assessment criteria can be customized by the admin.
-   **Data Export & Reporting**: Robust exporting capabilities to generate professional documents:
    -   Export student biodata lists to **PDF** and **Excel**.
    -   Generate and download individual student savings logs ("Buku Tabungan") as a formatted **PDF** or **JPG** image.
    -   Export a comprehensive student report compilation, including assessment scores and embedded photos, directly to **Excel**.

## Tech Stack

-   **Frontend**: React, Vite, Chart.js, React Router
-   **Backend & Database**: Firebase (Firestore, Authentication, Storage)
-   **Styling**: Custom CSS with CSS Variables
-   **Data Export**: jsPDF, jspdf-autotable, ExcelJS, File-saver, html2canvas
-   **Deployment**: Vercel

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

-   Node.js (v18 or later)
-   npm or yarn

### Installation & Setup

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/achmad-dzidan/paud-rohani-fsr.git
    cd paud-rohani-fsr
    ```

2.  **Install NPM packages:**
    ```sh
    npm install
    ```

3.  **Set up Firebase Environment Variables:**

    Create a `.env` file in the root of the project and add your Firebase project configuration. You can find these credentials in your Firebase project settings.

    ```bash
    VITE_FIREBASE_API_KEY=your_api_key
    VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
    VITE_FIREBASE_PROJECT_ID=your_project_id
    VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
    VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
    VITE_FIREBASE_APP_ID=your_app_id
    ```

4.  **Run the development server:**
    ```sh
    npm run dev
    ```

    The application will be available at `http://localhost:5173`.
