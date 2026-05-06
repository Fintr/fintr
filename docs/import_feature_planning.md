# Import Feature Planning Document

## Overview

This document outlines the implementation plan for a unified data import feature that allows users to import transactions via Excel files. The import functionality will be available in both the onboarding flow and settings page, with a consistent user experience across both entry points.

## Goals

1. **Unified Import Experience**: Same UI/UX whether importing during onboarding or from settings
2. **Excel Support**: write Excel files using `fast_excel` gem. Read excel files using [xsv](https://github.com/martijn/xsv)
3. **Data Validation**: Track and report import statistics (read, inserted, failed)
4. **Import History**: Persist import records for reporting and revert functionality
5. **Auto-create Categories**: Create new categories if they don't exist during import
6. **Error Reporting**: Detailed feedback on what succeeded and what failed

---

## Database Schema

### New Tables

#### 1. `imports` table
Tracks each import operation with metadata and results.

```ruby
create_table :imports, id: :uuid do |t|
  t.references :user, null: false, foreign_key: { to_table: :users }, type: :uuid
  t.references :space, null: false, foreign_key: { to_table: :spaces }, type: :uuid
  t.string :status, null: false, default: "pending" # pending, processing, completed, failed
  t.string :import_location, null: false # "onboarding", "settings"
  t.integer :total_rows_read, default: 0
  t.integer :total_rows_inserted, default: 0
  t.integer :total_rows_failed, default: 0
  t.jsonb :errors, default: [] # Array of error objects with row data
  t.jsonb :metadata, default: {} # Additional metadata (file name, etc.)
  t.datetime :processed_at
  t.timestamps
  
  t.index [:user_id, :created_at]
  t.index [:space_id, :created_at]
  t.index :status
end
```

#### 2. `import_records` table
Tracks individual records created from an import, enabling revert functionality and editing of failed records.

```ruby
create_table :import_records, id: :uuid do |t|
  t.references :import, null: false, foreign_key: { to_table: :imports }, type: :uuid
  t.string :record_type # "Transactions::Transaction", "Transactions::Category", "Transactions::Account" (null if failed)
  t.uuid :record_id # null if record was not created (failed)
  t.integer :row_number, null: false # Row number from Excel file
  t.jsonb :original_data, default: {} # Original row data for reference
  t.jsonb :edited_data, default: {} # User-edited data for failed records
  t.string :status, null: false, default: "pending" # "pending", "success", "failed", "edited"
  t.jsonb :errors, default: [] # Array of error messages if failed
  t.timestamps
  
  t.index [:import_id, :record_type]
  t.index [:import_id, :status] # For filtering failed records
  t.index [:record_type, :record_id] # Only if record_id is present
end
```

**Note**: The `record_id` and `record_type` can be null for failed records that haven't been created yet. This allows tracking failed rows that can be edited and re-imported individually.

---

## Backend Implementation

### Namespace Structure

All import-related code will be namespaced under `Imports`:

```
app/
  controllers/
    api/v1/
      imports/
        imports_controller.rb
        sample_templates_controller.rb
  models/
    imports/
      import.rb
      import_record.rb
  operations/
    imports/
      operations/
        create_import.rb
        process_import.rb
        generate_sample_template.rb
        revert_import.rb
        update_import_record.rb
        import_single_record.rb
      queries/
        list_imports.rb
        list_import_records.rb
        show_import_report.rb
  serializers/
    imports/
      import_serializer.rb
      import_record_serializer.rb
```

### Models

#### `Imports::Import`
```ruby
module Imports
  class Import < ApplicationRecord
    belongs_to :user, class_name: "Auth::User"
    belongs_to :space, class_name: "Spaces::Space"
    has_many :import_records, dependent: :destroy
    
    enum :status, {
      pending: "pending",
      processing: "processing",
      completed: "completed",
      failed: "failed",
      reverted: "reverted"
    }
    
    validates :import_location, presence: true, inclusion: { in: %w[onboarding settings] }
    
    scope :recent, -> { order(created_at: :desc) }
    scope :for_space, ->(space) { where(space: space) }
    
    def can_revert?
      (completed? || failed?) && import_records.successful.any?
    end
    
    def failed_records
      import_records.failed
    end
    
    def successful_records
      import_records.successful
    end
  end
end
```

#### `Imports::ImportRecord`
```ruby
module Imports
  class ImportRecord < ApplicationRecord
    belongs_to :import
    
    enum :status, {
      pending: "pending",
      success: "success",
      failed: "failed",
      edited: "edited" # User has edited the failed record
    }
    
    scope :successful, -> { where(status: :success).where.not(record_id: nil) }
    scope :failed, -> { where(status: [:failed, :edited]) }
    scope :editable, -> { where(status: [:failed, :edited]) }
    
    # Polymorphic reference to the created record (only for successful records)
    def record
      return nil if record_id.nil? || record_type.nil?
      record_type.constantize.find_by(id: record_id)
    end
    
    def record=(model_instance)
      self.record_type = model_instance.class.name
      self.record_id = model_instance.id
      self.status = :success
    end
    
    # Get the data to use for import (edited if available, otherwise original)
    def import_data
      edited_data.present? ? edited_data : original_data
    end
    
    # Mark as edited when user updates the data
    def mark_as_edited(data)
      self.edited_data = data
      self.status = :edited
      save!
    end
  end
end
```

### Controllers

#### `Imports::ImportsController`
```ruby
module Imports
  class ImportsController < ApiController
    # POST /api/v1/imports
    # Uploads Excel file and creates import record
    def create
      # 1. Validate file upload
      # 2. Create Import record with status "pending"
      # 3. Enqueue background job to process import
      # 4. Return import ID and status
    end
    
    # GET /api/v1/imports/:id
    # Shows import details and report
    def show
      # Return import with statistics, errors, and list of records
    end
    
    # GET /api/v1/imports
    # Lists user's import history
    def index
      # Return paginated list of imports for current user/space
    end
    
    # POST /api/v1/imports/:id/revert
    # Reverts an import by deleting all created records
    def revert
      # 1. Validate import can be reverted
      # 2. Delete all records tracked in import_records
      # 3. Update import status to "reverted"
      # 4. Return success
    end
  end
end
```

#### `Imports::ImportRecordsController`
```ruby
module Imports
  class ImportRecordsController < ApiController
    # PATCH /api/v1/imports/:import_id/import_records/:id
    # Updates a failed import record with edited data
    def update
      # 1. Find import_record
      # 2. Validate it's editable (failed or edited status)
      # 3. Update edited_data with user-provided data
      # 4. Mark status as "edited"
      # 5. Return updated import_record
    end
    
    # POST /api/v1/imports/:import_id/import_records/:id/import
    # Imports a single edited import record
    def import
      # 1. Find import_record
      # 2. Validate it's editable or edited
      # 3. Call ImportSingleRecord operation
      # 4. Update import_record with created transaction
      # 5. Return success with created record
    end
    
    # GET /api/v1/imports/:import_id/import_records
    # Lists all import records for an import (with filtering)
    def index
      # Return paginated list of import_records
      # Filter by status (failed, success, etc.)
    end
  end
end
```

#### `Imports::SampleTemplatesController`
```ruby
module Imports
  class SampleTemplatesController < ApiController
    # GET /api/v1/imports/sample_template
    # Generates and downloads sample Excel template
    def show
      # 1. Generate sample Excel file using fast_excel
      # 2. Return file as download
      # 3. Adds use of the current categories and account data that has been done in onboarding.
    end
  end
end
```

### Operations

#### `Imports::Operations::CreateImport`
```ruby
module Imports
  module Operations
    class CreateImport < Dry::Operation
      # Validates file upload and creates Import record
      # Returns Success(import) or Failure(errors)
    end
  end
end
```

#### `Imports::Operations::ProcessImport`
```ruby
module Imports
  module Operations
    class ProcessImport < Dry::Operation
      # Background job operation
      # 1. Reads Excel file using fast_excel
      # 2. Validates each row
      # 3. Creates transactions, categories, accounts as needed
      # 4. Tracks successes and failures in Import and ImportRecord
      # 5. Updates Import status to completed/failed
    end
  end
end
```

#### `Imports::Operations::GenerateSampleTemplate`
```ruby
module Imports
  module Operations
    class GenerateSampleTemplate < Dry::Operation
      # Generates sample Excel file with:
      # - Header row with column names
      # - 2-3 example rows with sample data
      # - Returns file path or blob
      # - Should only be temporary, removes after ingested.
    end
  end
end
```

#### `Imports::Operations::RevertImport`
```ruby
module Imports
  module Operations
    class RevertImport < Dry::Operation
      # Reverts an import by:
      # 1. Finding all successful ImportRecords for the import
      # 2. Deleting the associated records (gracefully handle already deleted)
      # 3. Updating Import status to "reverted"
      # 4. Returns Success or Failure
    end
  end
end
```

#### `Imports::Operations::UpdateImportRecord`
```ruby
module Imports
  module Operations
    class UpdateImportRecord < Dry::Operation
      # Updates a failed import record with user-edited data
      # 1. Validates import_record exists and is editable
      # 2. Validates edited data structure
      # 3. Updates import_record.edited_data
      # 4. Marks status as "edited"
      # 5. Returns Success(import_record) or Failure(errors)
    end
  end
end
```

#### `Imports::Operations::ImportSingleRecord`
```ruby
module Imports
  module Operations
    class ImportSingleRecord < Dry::Operation
      # Imports a single import record (for edited failed records)
      # 1. Gets data from import_record (edited_data or original_data)
      # 2. Validates data
      # 3. Gets or creates default "Import" account (see below)
      # 4. Finds or creates category
      # 5. Creates transaction with balance_state: "pending" (skip calculation)
      # 6. Creates ImportRecord linking to transaction
      # 7. Updates import_record status to "success"
      # 8. Returns Success(transaction) or Failure(errors)
    end
  end
end
```

### Background Job

#### `Imports::ProcessImportJob`
```ruby
module Imports
  class ProcessImportJob < ApplicationJob
    queue_as :default
    
    def perform(import_id)
      import = Imports::Import.find(import_id)
      import.update!(status: "processing")
      
      result = Imports::Operations::ProcessImport.new.call(
        import: import
      )
      
      if result.success?
        import.update!(status: "completed", processed_at: Time.current)
      else
        import.update!(status: "failed")
      end
    end
  end
end
```

### Default Import Account

**Important**: All imported transactions will use a default "Import" account to avoid requiring users to specify accounts and to prevent balance calculation issues.

#### Account Creation Logic
- On first import for a space, automatically create an account named "Import" with:
  - `name`: "Import"
  - `balance_cents`: 0
  - `account_category`: "cash" (or appropriate default)
  - `space_id`: Current space
- This account is created once per space and reused for all imports
- Users can see transactions in this account but it won't affect their actual account balances

#### Benefits
1. Users don't need to specify which account to use
2. Imported transactions don't affect actual account balances
3. Users can later move transactions to correct accounts if needed
4. Clear separation between imported and manually entered transactions

### Excel Processing Logic

#### Required Columns (for Transactions)
- `date` (required): Date in format YYYY-MM-DD
- `description` (required): Transaction description
- `amount` (required): Amount (positive number)
- `type` (required): "income" or "expense"
- `category` (required): Category name (will be created if doesn't exist)
- ~~`account` (required): Account name (must exist or will fail)~~ **REMOVED** - Uses default "Import" account

#### Processing Steps
1. **Get or create default "Import" account** for the space
2. Read Excel file row by row using `xsv` gem
3. Skip header row
4. For each row:
   - Validate required fields (date, description, amount, type, category)
   - Find or create category (if new, respecting income/expense type)
   - Use default "Import" account (no account lookup needed)
   - Create transaction with `balance_state: "pending"` to skip balance calculation
   - Create ImportRecord linking to transaction with status "success"
   - Track success/failure
5. For failed rows:
   - Create ImportRecord with status "failed", no record_id
   - Store original_data and error messages
6. Update Import with statistics

#### Balance Calculation Skip
- All imported transactions are created with `balance_state: "pending"`
- This prevents automatic balance recalculation
- Account balances remain unchanged by imports
- Users can manually trigger balance calculation if needed

---

## Frontend Implementation

### Shared Components

#### `ImportWizard` Component
A reusable component used in both onboarding and settings:

```typescript
// src/components/import/import-wizard.tsx
interface ImportWizardProps {
  onImportComplete?: (importId: string) => void;
  context: 'onboarding' | 'settings';
  spaceId: string;
}
```

Features:
- Step 1: Ask if user wants to import
- Step 2: Show sample template download option
- Step 3: File upload with drag & drop
- Step 4: Show import progress
- Step 5: Show import results (success/failure counts, errors)

#### `ImportResults` Component
Displays import statistics and errors:

```typescript
interface ImportResultsProps {
  importId: string;
  onRevert?: () => void;
}
```

Shows:
- Total rows read
- Successfully inserted
- Failed rows with error messages
- Option to download error report
- Revert button (if applicable)
- **Edit failed records** functionality
- **Import individual records** button for edited records

#### `ImportRecordEditor` Component
Allows editing of failed import records:

```typescript
interface ImportRecordEditorProps {
  importRecord: ImportRecord;
  onSave: (data: RecordData) => void;
  onImport: () => void;
}
```

Features:
- Form with editable fields (date, description, amount, type, category)
- Validation
- Save edited data
- Import single record button
- Shows original data and errors

### Onboarding Integration

#### Location: `/onboarding/step4` (new step)
After step 3 (accounts), add a new step asking about import:

```typescript
// src/app/(private)/onboarding/step4/page.tsx
export default function OnboardingStep4() {
  // Show ImportWizard with context="onboarding"
  // If user chooses to import, process import
  // Then proceed to completion page
}
```

Flow:
1. Ask: "Would you like to import your existing transactions?"
2. If Yes: Show ImportWizard
3. If No: Skip to completion
4. After import: Show results and continue

### Settings Integration

#### Location: Settings > Data Management > Import Data
Add new section in settings:

```typescript
// src/components/dashboard/tabs/settings-configurations-tab.tsx
// Add new tab: "Data Management"
// Sub-section: "Import Data"
```

Features:
- Import history list
- New import button (opens ImportWizard)
- View past imports with detailed results
- Revert imports option
- **Edit failed import records** - Users can edit failed records and fix errors
- **Import single record** - Users can import individual edited records one at a time
- Filter imports by status
- View and manage failed records

### API Service

#### `src/services/imports/mutations.tsx`
```typescript
export const createImport = async (params: {
  api: AxiosInstance;
  file: File;
  spaceId: string;
  importLocation: 'onboarding' | 'settings';
}) => { ... };

export const revertImport = async (params: {
  api: AxiosInstance;
  importId: string;
}) => { ... };

export const updateImportRecord = async (params: {
  api: AxiosInstance;
  importId: string;
  importRecordId: string;
  data: {
    date?: string;
    description?: string;
    amount?: number;
    type?: 'income' | 'expense';
    category?: string;
  };
}) => { ... };

export const importSingleRecord = async (params: {
  api: AxiosInstance;
  importId: string;
  importRecordId: string;
}) => { ... };
```

#### `src/services/imports/queries.tsx`
```typescript
export const fetchImport = async (params: {
  api: AxiosInstance;
  importId: string;
}) => { ... };

export const fetchImports = async (params: {
  api: AxiosInstance;
  spaceId: string;
  page?: number;
  status?: string;
}) => { ... };

export const fetchImportRecords = async (params: {
  api: AxiosInstance;
  importId: string;
  status?: 'failed' | 'success' | 'edited';
  page?: number;
}) => { ... };

export const fetchImportRecord = async (params: {
  api: AxiosInstance;
  importId: string;
  importRecordId: string;
}) => { ... };

export const downloadSampleTemplate = async (params: {
  api: AxiosInstance;
}) => { ... };
```

### Hooks

#### `src/hooks/async/useImport.ts`
```typescript
export const useImport = (importId?: string) => {
  // Fetch import details
  // Track import status
  // Poll for completion if processing
};
```

---

## Routes

### Backend Routes
```ruby
namespace :imports do
  resources :imports, only: [:index, :show, :create] do
    member do
      post :revert
    end
    resources :import_records, only: [:index, :show, :update] do
      member do
        post :import # Import single record
      end
    end
  end
  resource :sample_template, only: [:show]
end
```

### Frontend Routes
- `/onboarding/step4` - Import step in onboarding
- `/dashboard/settings?tab=data-management` - Import in settings

---

## Excel Template Format

### Sample Template Structure

| date       | description        | amount | type    | category |
|------------|--------------------|--------|---------|----------|
| 2024-01-15 | Salary Payment     | 50000  | income  | Salary   |
| 2024-01-16 | SM groceries       | 2500   | expense | Food     |
| 2024-01-17 | Netflix Subscription | 500  | expense | Subscriptions |

**Note**: The `account` column has been removed. All imported transactions will automatically use the default "Import" account.

### Validation Rules
- `date`: Must be valid date format (YYYY-MM-DD)
- `amount`: Must be positive number
- `type`: Must be "income" or "expense"
- `category`: Will be auto-created if doesn't exist. Take note that there are income categories and expense categories - create the appropriate type based on the transaction type.
- ~~`account`: Must exist in user's accounts~~ **REMOVED** - All transactions use default "Import" account

---

## Error Handling & Reporting

### Error Types
1. **Validation Errors**: Missing required fields, invalid formats
2. **Business Logic Errors**: Account doesn't exist, invalid category type
3. **System Errors**: Database errors, file read errors

### Error Report Format
Each error in `imports.errors` JSONB field:
```json
{
  "row_number": 5,
  "row_data": {
    "date": "2024-01-15",
    "description": "Test",
    "amount": "1000",
    "type": "expense",
    "category": "Food"
  },
  "errors": [
    "Invalid date format: expected YYYY-MM-DD"
  ]
}
```

### User Feedback
- Show summary: "X rows imported successfully, Y rows failed"
- List failed rows with specific error messages
- **Edit failed records inline** with form validation
- **Import single edited record** button for each failed row
- Option to download error report as CSV/Excel
- Option to bulk edit and re-import multiple records

---

## Revert Functionality

### Requirements
- Any imports can be reverted. If the import fails, the user should have an option to revert them.
- Reverts all records created in that import
- Updates Import status to "reverted"
- Shows confirmation dialog before revert

### Implementation
1. Find all ImportRecords for the import
2. For each record:
   - Find the actual record (transaction, category, etc.)
   - Delete it (if still exists)
   - Delete the ImportRecord
3. Update Import status
4. Return success/failure

### Edge Cases
- **Transaction already deleted during revert**: 
  - Ignore if the specific transaction ID is deleted (race condition possible)
  - Continue with other record deletions
  - Mark ImportRecord as handled even if record doesn't exist
- **Category used by other transactions**:
  - Only revert category if it has no other transactions
  - If category has other transactions, keep it but mark ImportRecord as reverted
  - Show warning to user about categories that couldn't be deleted
- **Default "Import" account**:
  - Account is created once per space on first import
  - If account is deleted, recreate it on next import
  - Account is not deleted during revert (only transactions are deleted)
- **Edited records**:
  - Users can edit failed records multiple times
  - Each edit updates the `edited_data` field
  - Importing a single record uses the latest `edited_data`

---

## Testing/Specs Outline

### Backend Specs

#### Model Specs
- `spec/models/imports/import_spec.rb`
  - Associations
  - Validations
  - Scopes
  - `can_revert?` method

- `spec/models/imports/import_record_spec.rb`
  - Associations
  - Polymorphic record access

#### Operation Specs
- `spec/operations/imports/operations/create_import_spec.rb`
  - Valid file upload
  - Invalid file handling
  - Import record creation

- `spec/operations/imports/operations/process_import_spec.rb`
  - Successful import
  - Partial success (some rows fail)
  - Complete failure
  - Category auto-creation (income vs expense types)
  - Default "Import" account creation/retrieval
  - Transaction creation with balance_state: "pending"
  - ImportRecord creation for successful and failed records
  - Error tracking and storage

- `spec/operations/imports/operations/generate_sample_template_spec.rb`
  - Template generation
  - File format validation
  - Sample data correctness

- `spec/operations/imports/operations/revert_import_spec.rb`
  - Successful revert
  - Revert with missing records (graceful handling)
  - Revert with dependencies (categories with other transactions)

- `spec/operations/imports/operations/update_import_record_spec.rb`
  - Update failed record with valid data
  - Update record that's already successful (should fail)
  - Validation of edited data
  - Status update to "edited"

- `spec/operations/imports/operations/import_single_record_spec.rb`
  - Import single edited record successfully
  - Import with default "Import" account
  - Category auto-creation
  - Balance state set to "pending"
  - ImportRecord status update
  - Error handling for invalid data

#### Controller Specs
- `spec/requests/api/v1/imports/imports_spec.rb`
  - POST /api/v1/imports (create)
  - GET /api/v1/imports/:id (show)
  - GET /api/v1/imports (index)
  - POST /api/v1/imports/:id/revert (revert)

- `spec/requests/api/v1/imports/import_records_spec.rb`
  - GET /api/v1/imports/:import_id/import_records (index)
  - GET /api/v1/imports/:import_id/import_records/:id (show)
  - PATCH /api/v1/imports/:import_id/import_records/:id (update)
  - POST /api/v1/imports/:import_id/import_records/:id/import (import single record)

- `spec/requests/api/v1/imports/sample_templates_spec.rb`
  - GET /api/v1/imports/sample_template (download)

#### Job Specs
- `spec/jobs/imports/process_import_job_spec.rb`
  - Job execution
  - Status updates
  - Error handling

### Frontend Specs

#### Component Specs
- `src/components/import/__tests__/import-wizard.test.tsx`
  - Step navigation
  - File upload
  - Progress display
  - Results display

- `src/components/import/__tests__/import-results.test.tsx`
  - Statistics display
  - Error listing
  - Revert functionality
  - Edit failed records functionality
  - Import single record functionality

- `src/components/import/__tests__/import-record-editor.test.tsx`
  - Form validation
  - Data editing
  - Save functionality
  - Import single record functionality

#### Integration Specs
- Onboarding flow with import
- Settings import flow
- Error handling and retry

---

## Implementation Checklist

### Phase 1: Backend Foundation
- [ ] Create database migrations (imports, import_records tables)
- [ ] Create models (Import, ImportRecord)
- [ ] Add fast_excel gem to Gemfile (for writing)
- [ ] Add xsv gem to Gemfile (for reading)
- [ ] Create default "Import" account helper/utility
- [ ] Create base operations structure
- [ ] Create sample template generator

### Phase 2: Import Processing
- [ ] Implement ProcessImport operation
  - [ ] Use default "Import" account
  - [ ] Set balance_state to "pending"
  - [ ] Track successful and failed records
- [ ] Create background job
- [ ] Add error tracking
- [ ] Implement ImportRecord tracking (success and failed)
- [ ] Implement UpdateImportRecord operation
- [ ] Implement ImportSingleRecord operation

### Phase 3: API Endpoints
- [ ] Create imports controller
- [ ] Create import_records controller (update, import single)
- [ ] Create sample templates controller
- [ ] Add routes
- [ ] Add serializers (Import, ImportRecord)

### Phase 4: Frontend Components
- [ ] Create ImportWizard component
- [ ] Create ImportResults component
- [ ] Create ImportRecordEditor component
- [ ] Add API service functions (create, update, import single record)
- [ ] Create hooks (useImport, useImportRecords)

### Phase 5: Integration
- [ ] Add import step to onboarding
- [ ] Add import section to settings
- [ ] Implement revert functionality
- [ ] Add error reporting UI
- [ ] Add edit failed records UI
- [ ] Add import single record functionality
- [ ] Add import history and management UI

### Phase 6: Testing
- [ ] Write backend specs
- [ ] Write frontend tests
- [ ] Integration testing
- [ ] Manual QA testing

---

## Dependencies

### Backend
- `fast_excel` gem - For writing Excel templates
- `xsv` gem - For reading Excel files (fast CSV/Excel parsing)
- `active_storage` (for file uploads - already in use)
- Background job system (SolidQueue - already in use)

### Frontend
- File upload component (existing or new)
- Excel download capability
- Progress indicators
- Error display components

---

## Notes & Considerations

1. **File Size Limits**: Set reasonable limits (e.g., 10MB max)
2. **Row Limits**: Consider limiting rows per import (e.g., 10,000 rows)
3. **Performance**: Process large imports in background
4. **Security**: Validate file types, sanitize input
5. **User Experience**: Show progress for long-running imports
6. **Data Integrity**: Ensure transactions are created with proper validations
7. **Category Creation**: Auto-create categories but allow user to review/merge later
8. **Default Import Account**: Automatically created per space, reused for all imports
9. **Balance Calculation**: All imported transactions have `balance_state: "pending"` to prevent automatic balance updates
10. **Record Editing**: Failed records can be edited and re-imported individually
11. **Import Record Management**: Users can manage and track all import records, edit failed ones, and import them individually

---

## Future Enhancements

1. **Import Scheduling**: Schedule recurring imports
2. **Import Templates**: Save and reuse import configurations
3. **CSV Support**: Add CSV file format support
4. **Auto-mapping**: Smart column mapping for different Excel formats
5. **Bulk Category Management**: Review and merge auto-created categories
6. **Import Analytics**: Track import patterns and success rates

