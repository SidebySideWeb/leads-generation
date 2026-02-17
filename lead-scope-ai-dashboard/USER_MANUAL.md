# LeadScope User Manual

## How to Create a Discovery and Export Data

This guide will walk you through the complete process of discovering businesses and exporting them to an Excel file.

---

## Table of Contents

1. [Creating a Discovery](#creating-a-discovery)
2. [Understanding Discovery Results](#understanding-discovery-results)
3. [Exporting Your Data](#exporting-your-data)
4. [Downloading Your Export](#downloading-your-export)
5. [Managing Your Datasets](#managing-your-datasets)
6. [Troubleshooting](#troubleshooting)

---

## Creating a Discovery

### Step 1: Navigate to the Discover Page

1. Log in to your LeadScope account
2. Click on **"Discover"** in the navigation menu (or go to `/discover`)

### Step 2: Select Your Search Criteria

On the Discover page, you'll see three dropdown menus:

#### **Prefecture** (Περιφέρεια)
- Select the prefecture where you want to find businesses
- Example: "Αττικής", "Θεσσαλονίκης", etc.

#### **Municipality** (Δήμος)
- After selecting a prefecture, choose the specific municipality
- The list will automatically filter based on your prefecture selection
- Example: "Αθήνα", "Θεσσαλονίκη", etc.

#### **Industry** (Κλάδος)
- Select the industry or business type you're looking for
- Examples: "Restaurants", "IT Services", "Retail", etc.

### Step 3: Search for Businesses

1. Once you've selected all three criteria (Prefecture, Municipality, and Industry), click the **"Search"** button
2. The system will:
   - First check your local database for existing businesses matching your criteria
   - If no results are found locally, it will automatically trigger a **GEMI Deep Discovery** to fetch businesses from the Greek Business Registry

### Step 4: Wait for Discovery to Complete

- You'll see a loading indicator while the discovery is running
- The discovery process may take a few seconds to several minutes depending on:
  - The number of businesses found
  - The complexity of the search
- You can see the progress in real-time as businesses are discovered

---

## Understanding Discovery Results

### Discovery Completion Modal

When the discovery completes, a modal will appear with the following information:

#### **Success Message**
- Shows the number of businesses discovered
- Example: "Successfully discovered **150 businesses**"

#### **What Would You Like to Do Next?**

You have three options:

##### 1. **Save Dataset** 💾
- Click **"Save Dataset"** to view and manage your dataset
- Takes you to the dataset details page
- You can view all businesses, filter them, and manage the dataset

##### 2. **Proceed to Export** 📥
- Click **"Proceed to Export"** to immediately create an export
- Takes you to the dataset page with the export dialog open
- Perfect if you want to download the data right away

##### 3. **Close** ✖️
- Click **"Close"** to dismiss the modal
- Your dataset is still saved - you can access it later from the Datasets page

### Viewing Discovery Results

After discovery completes, you'll see:

- **A table** showing the discovered businesses with:
  - Business name
  - Address
  - Phone number (if available)
  - Email (if available)
  - Website (if available)
- **Search metadata** showing:
  - Total businesses found
  - Number of businesses returned in the current view
  - Your plan limits

---

## Exporting Your Data

There are two ways to create an export:

### Method 1: From the Discovery Completion Modal

1. When the discovery completes, click **"Proceed to Export"** in the completion modal
2. This will take you directly to the export creation dialog

### Method 2: From the Datasets Page

1. Navigate to **"Datasets"** in the navigation menu
2. Find your dataset in the list
3. Click the **"Export"** button (or the three-dot menu → Export)
4. The export modal will open

### Method 3: From the Exports Page

1. Navigate to **"Exports"** in the navigation menu
2. Click the **"Add Export"** button (or **"Create Export"**)
3. Select your dataset from the dropdown
4. Choose your export format

### Creating the Export

In the **Export Modal**, you'll see:

#### **Select Dataset**
- Choose the dataset you want to export
- Each dataset shows:
  - Dataset name (e.g., "Αθήνα - Restaurants")
  - Location and industry
  - Number of businesses

#### **Export Format**
- **Excel (.xlsx)** - Recommended for large datasets
  - Best for Microsoft Excel, Google Sheets, and other spreadsheet applications
  - Supports formatting and multiple sheets
- **CSV (.csv)** - Compatible with all spreadsheet apps
  - Simple text format
  - Works with any spreadsheet application

#### **Dataset Summary**
The modal shows a summary card with:
- Dataset name
- Location (city/municipality)
- Industry
- Total number of businesses

#### **Create Export**

1. Select your dataset
2. Choose your format (Excel or CSV)
3. Review the summary
4. Click **"Create Export"**

### Export Processing

- The export will be processed in the background
- You'll see a notification: "Export started - Your export is being processed..."
- The export may take a few seconds to several minutes depending on the dataset size
- You can continue using the application while the export processes

---

## Downloading Your Export

### Step 1: Navigate to the Exports Page

1. Click **"Exports"** in the navigation menu
2. You'll see a list of all your exports

### Step 2: Find Your Export

The exports table shows:

- **Status Badge**:
  - 🟢 **Completed** - Ready to download
  - 🟡 **Processing** - Still being generated (auto-updates)
  - 🔴 **Failed** - An error occurred

- **Export Information**:
  - Dataset name
  - Format (Excel or CSV)
  - Number of businesses
  - Created date
  - File size (when completed)

### Step 3: Download the File

1. Find your completed export in the list
2. Click the **"Download"** button (or the download icon)
3. The file will download to your computer

#### **Export Status**

- **Processing**: The export is being generated. The page will automatically refresh when it's ready.
- **Completed**: Click the download button to get your file.
- **Failed**: If an export fails, try creating a new one. If the problem persists, contact support.

### File Details

- **File Name**: `export-{dataset-name}-{timestamp}.xlsx` (or `.csv`)
- **Location**: Usually downloads to your browser's default download folder
- **Format**: Excel files can be opened in:
  - Microsoft Excel
  - Google Sheets (upload to Google Drive)
  - LibreOffice Calc
  - Apple Numbers

---

## Managing Your Datasets

### Viewing All Datasets

1. Go to **"Datasets"** in the navigation menu
2. You'll see a list of all your datasets with:
   - Dataset name (e.g., "Αθήνα - Restaurants")
   - Location and industry
   - Number of businesses
   - Last refresh date
   - Completeness metrics (email, phone, website coverage)

### Dataset Actions

For each dataset, you can:

- **View Details**: Click on the dataset name or the "View" button
- **Export**: Create a new export from this dataset
- **View Businesses**: See all businesses in the dataset

### All Discoveries Section

At the bottom of the Datasets page, you'll see:

- **All Discoveries**: A table showing all discovery runs you've made
- Information includes:
  - Status (Running, Completed, Failed)
  - Associated dataset
  - Industry and city
  - Number of businesses found
  - Discovery date

---

## Troubleshooting

### Discovery Issues

**Problem**: Discovery is taking too long
- **Solution**: Large municipalities or industries may take several minutes. Wait for the process to complete. Check your internet connection.

**Problem**: No businesses found
- **Solution**: 
  - Try a different municipality or industry
  - Check if the industry exists in the Greek Business Registry
  - Verify your search criteria are correct

**Problem**: Discovery failed
- **Solution**: 
  - Check your internet connection
  - Try again after a few moments
  - If the problem persists, contact support

### Export Issues

**Problem**: Export is stuck in "Processing"
- **Solution**: 
  - Wait a few more minutes for large datasets
  - Refresh the Exports page
  - If it's been more than 10 minutes, try creating a new export

**Problem**: Can't download export
- **Solution**: 
  - Check your browser's download settings
  - Try a different browser
  - Check if the file was blocked by your antivirus
  - Ensure you have enough disk space

**Problem**: Export file is corrupted
- **Solution**: 
  - Try downloading again
  - Create a new export
  - Try the CSV format instead of Excel

### General Issues

**Problem**: Can't see my datasets/exports
- **Solution**: 
  - Ensure you're logged in
  - Check if you're on the correct account
  - Refresh the page
  - Clear your browser cache

**Problem**: Page is not loading
- **Solution**: 
  - Check your internet connection
  - Try refreshing the page
  - Clear browser cache and cookies
  - Try a different browser

---

## Tips and Best Practices

### Discovery Tips

1. **Be Specific**: The more specific your search criteria, the better the results
2. **Start Small**: For testing, start with smaller municipalities
3. **Check Results**: Review the discovered businesses before exporting
4. **Reuse Datasets**: Datasets are automatically reused if they're less than 30 days old

### Export Tips

1. **Use Excel for Large Datasets**: Excel format is better for datasets with more than 1,000 businesses
2. **Check File Size**: Large exports may take longer to download
3. **Save Exports**: Downloaded exports are not stored permanently - download them while they're available
4. **Multiple Formats**: You can create multiple exports (Excel and CSV) from the same dataset

### Data Quality

- **Email Coverage**: Not all businesses have email addresses listed
- **Phone Numbers**: Phone numbers are available when provided by the business registry
- **Websites**: Website URLs are included when available
- **Data Freshness**: Datasets are automatically refreshed if older than 30 days

---

## Quick Reference

### Keyboard Shortcuts

- **Ctrl/Cmd + K**: Open search (if available)
- **Esc**: Close modals

### Navigation

- **Discover**: `/discover` - Create new discoveries
- **Datasets**: `/datasets` - View all your datasets
- **Exports**: `/exports` - View and download exports
- **Billing**: `/billing` - View usage and subscription

### Support

If you need help:
1. Check this manual
2. Review the troubleshooting section
3. Contact support through your account dashboard

---

## Glossary

- **Discovery**: The process of finding businesses matching your criteria
- **Dataset**: A collection of businesses organized by location and industry
- **Export**: A downloadable file containing your dataset data
- **GEMI**: Greek Business Registry (Γενικό Μητρώο Εταιρειών)
- **Municipality**: A local administrative unit (Δήμος)
- **Prefecture**: A regional administrative unit (Περιφέρεια)

---

**Last Updated**: February 2025

**Version**: 1.0
