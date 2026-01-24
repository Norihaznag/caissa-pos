# CaissaPro Admin Dashboard

Admin dashboard for managing CaissaPro POS licenses, devices, and subscriptions.

## Features

- 📊 **Dashboard**: Overview of active licenses, revenue, and recent activity
- 🔑 **License Management**: Create, view, suspend, and revoke licenses
- 📱 **Device Monitoring**: Track registered devices and their trial/license status
- 📋 **Activity Logs**: View all system activity and license operations
- ⚙️ **Settings**: Configure system parameters

## Setup

### 1. Install Dependencies

```bash
cd admin-dashboard
npm install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Setup Supabase Database

Run the SQL schema in your Supabase SQL Editor:

```sql
-- Located at: ../lib/license/schema.sql
```

This creates the following tables:
- `devices` - Registered devices with trial tracking
- `licenses` - License keys and their status
- `license_logs` - Activity logging

### 4. Run Development Server

```bash
npm run dev
```

The dashboard will be available at `http://localhost:5173`

### 5. Build for Production

```bash
npm run build
```

The built files will be in the `dist/` folder.

## Usage

### Creating a License

1. Go to **Licenses** page
2. Click **Create License**
3. Enter customer email (optional)
4. Enter notes (optional)
5. Click **Create**
6. Copy the generated license key and send to customer

### Monitoring Devices

The **Devices** page shows:
- All registered devices
- Trial start dates and remaining time
- Associated license (if activated)
- Last seen timestamp

### Viewing Logs

The **Logs** page provides:
- Complete activity history
- Filter by action type
- Device and license associations

## License Model

- **Price**: 600 DH/year
- **Trial Period**: 7 days (configurable)
- **Offline Grace**: 30 days

## Tech Stack

- React 18
- TypeScript
- Vite
- TailwindCSS
- Supabase
- React Router DOM
- Recharts (for charts)
- Lucide React (icons)
