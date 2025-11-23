# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2025_11_21_073244) do

  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"
  enable_extension "pgcrypto"
  enable_extension "timescaledb"
  enable_extension "timescaledb_toolkit"
  enable_extension "vector"
  enable_extension "vectorscale"

  # Custom types defined in this database.
  # Note that some types may not work with other database engines. Be careful if changing database.
  create_enum "account_category", ["cash", "savings", "debit", "credit_card", "e_wallet", "loan", "investment"]
  create_enum "ai_usages_ai_status", ["pending", "success", "failure"]
  create_enum "ai_usages_ai_type", ["pure_ai_ocr", "ai_chat"]
  create_enum "balance_state", ["pending", "calculated"]
  create_enum "category_type_enum", ["income", "expense"]
  create_enum "crm_priority", ["low", "medium", "high", "urgent"]
  create_enum "crm_ticket_response_type", ["user_reply", "admin_response", "system_update"]
  create_enum "crm_ticket_status", ["open", "in_progress", "resolved", "dismissed"]
  create_enum "crm_ticket_type", ["bug_report", "feature_request", "general_feedback", "help_request", "billing_issue", "account_issue", "other"]
  create_enum "finance_payment_status", ["pending", "succeeded", "failed", "refunded"]
  create_enum "finance_space_subscription_status", ["requires_action", "pending", "active", "inactive"]
  create_enum "onboarding_step_enum", ["income", "budgets", "accounts", "completed"]
  create_enum "repeat_interval", ["every_day", "every_week", "every_2_weeks", "every_month", "every_2_months", "every_3_months", "every_6_months", "every_year"]
  create_enum "schedule_type", ["one_time", "repeat", "installment"]

  create_table "accounts", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.enum "account_category", null: false, enum_type: "account_category"
    t.bigint "balance_cents", default: 0, null: false
    t.string "balance_currency", default: "PHP", null: false
    t.datetime "created_at", null: false
    t.datetime "discarded_at"
    t.string "name", null: false
    t.uuid "space_id", null: false
    t.datetime "updated_at", null: false
    t.index ["discarded_at"], name: "index_accounts_on_discarded_at"
    t.index ["space_id", "name"], name: "index_accounts_on_space_id_and_name_where_not_discarded", unique: true, where: "(discarded_at IS NULL)"
    t.index ["space_id"], name: "index_accounts_on_space_id"
  end

  create_table "active_storage_attachments", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "blob_id", null: false
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.uuid "record_id", null: false
    t.string "record_type", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.string "content_type"
    t.datetime "created_at", null: false
    t.string "filename", null: false
    t.string "key", null: false
    t.text "metadata"
    t.string "service_name", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "ai_conversation_messages", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.text "content", null: false
    t.uuid "conversation_id", null: false
    t.datetime "created_at", null: false
    t.jsonb "metadata", default: {}
    t.integer "openai_role", default: 0, null: false
    t.datetime "updated_at", null: false
    t.index ["conversation_id", "created_at"], name: "idx_on_conversation_id_created_at_c02dfcf735"
    t.index ["conversation_id"], name: "index_ai_conversation_messages_on_conversation_id"
    t.index ["openai_role"], name: "index_ai_conversation_messages_on_openai_role"
  end

  create_table "ai_conversations", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "last_message_at"
    t.string "openai_conversation_id", null: false
    t.uuid "space_id", null: false
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["last_message_at"], name: "index_ai_conversations_on_last_message_at"
    t.index ["openai_conversation_id"], name: "index_ai_conversations_on_openai_conversation_id", unique: true
    t.index ["space_id", "created_at"], name: "index_ai_conversations_on_space_id_and_created_at"
    t.index ["space_id"], name: "index_ai_conversations_on_space_id"
    t.index ["user_id", "created_at"], name: "index_ai_conversations_on_user_id_and_created_at"
    t.index ["user_id"], name: "index_ai_conversations_on_user_id"
  end

  create_table "ai_interactions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "enhanced_prompt"
    t.text "error"
    t.jsonb "metadata", default: {}
    t.text "request", null: false
    t.text "response"
    t.string "session_id", null: false
    t.uuid "space_id", null: false
    t.string "status", default: "pending"
    t.decimal "time_seconds", precision: 6, scale: 2, default: "0.0"
    t.integer "tokens_used", default: 0
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["session_id"], name: "index_ai_interactions_on_session_id"
    t.index ["space_id", "created_at"], name: "index_ai_interactions_on_space_id_and_created_at"
    t.index ["space_id"], name: "index_ai_interactions_on_space_id"
    t.index ["status"], name: "index_ai_interactions_on_status"
    t.index ["user_id", "created_at"], name: "index_ai_interactions_on_user_id_and_created_at"
    t.index ["user_id"], name: "index_ai_interactions_on_user_id"
  end

  create_table "ai_usages", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.enum "ai_type", default: "pure_ai_ocr", null: false, enum_type: "ai_usages_ai_type"
    t.datetime "created_at", null: false
    t.jsonb "result", default: {}, null: false
    t.uuid "space_id", null: false
    t.enum "status", default: "pending", null: false, enum_type: "ai_usages_ai_status"
    t.decimal "time_seconds", precision: 6, scale: 2, default: "0.0", null: false
    t.integer "tokens_used", default: 1, null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["space_id"], name: "index_ai_usages_on_space_id"
    t.index ["user_id"], name: "index_ai_usages_on_user_id"
  end

  create_table "budgets", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.bigint "amount_cents", default: 0, null: false
    t.string "amount_currency", default: "PHP", null: false
    t.uuid "category_id", null: false
    t.datetime "created_at", null: false
    t.date "date", null: false
    t.uuid "space_id", null: false
    t.bigint "spent_cents", default: 0, null: false
    t.string "spent_currency", default: "PHP", null: false
    t.datetime "updated_at", null: false
    t.index ["amount_cents", "amount_currency"], name: "index_budgets_on_amount_cents_and_amount_currency"
    t.index ["category_id"], name: "index_budgets_on_category_id"
    t.index ["space_id", "category_id", "date"], name: "index_budgets_on_space_id_and_category_id_and_date", unique: true
    t.index ["space_id"], name: "index_budgets_on_space_id"
    t.index ["spent_cents", "spent_currency"], name: "index_budgets_on_spent_cents_and_spent_currency"
  end

  create_table "crm_ticket_responses", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "message", null: false
    t.uuid "responder_id"
    t.enum "response_type", default: "user_reply", null: false, enum_type: "crm_ticket_response_type"
    t.uuid "ticket_id", null: false
    t.datetime "updated_at", null: false
    t.index ["created_at"], name: "index_crm_ticket_responses_on_created_at"
    t.index ["responder_id"], name: "index_crm_ticket_responses_on_responder_id"
    t.index ["response_type"], name: "index_crm_ticket_responses_on_response_type"
    t.index ["ticket_id"], name: "index_crm_ticket_responses_on_ticket_id"
  end

  create_table "crm_tickets", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "description", default: "", null: false
    t.enum "priority", default: "low", null: false, enum_type: "crm_priority"
    t.uuid "space_id", null: false
    t.enum "status", default: "open", null: false, enum_type: "crm_ticket_status"
    t.enum "ticket_type", default: "bug_report", null: false, enum_type: "crm_ticket_type"
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["created_at"], name: "index_crm_tickets_on_created_at"
    t.index ["priority"], name: "index_crm_tickets_on_priority"
    t.index ["space_id"], name: "index_crm_tickets_on_space_id"
    t.index ["status"], name: "index_crm_tickets_on_status"
    t.index ["ticket_type"], name: "index_crm_tickets_on_ticket_type"
    t.index ["user_id"], name: "index_crm_tickets_on_user_id"
  end

  create_table "entities", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "entity_type", default: "loan", null: false
    t.string "full_name", null: false
    t.uuid "space_id", null: false
    t.datetime "updated_at", null: false
    t.index ["space_id", "entity_type", "full_name"], name: "index_entities_on_space_entity_type_full_name", unique: true
    t.index ["space_id", "entity_type"], name: "index_entities_on_space_id_and_entity_type"
    t.index ["space_id"], name: "index_entities_on_space_id"
  end

  create_table "finance_payments", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.bigint "amount_cents", null: false
    t.string "amount_currency", default: "PHP", null: false
    t.datetime "created_at", null: false
    t.datetime "failed_at"
    t.text "failure_reason"
    t.jsonb "metadata", default: {}, null: false
    t.datetime "paid_at"
    t.string "payment_method_id"
    t.string "payment_method_type"
    t.uuid "space_subscription_id", null: false
    t.enum "status", default: "pending", null: false, enum_type: "finance_payment_status"
    t.datetime "updated_at", null: false
    t.string "xendit_action_id", null: false
    t.string "xendit_cycle_id"
    t.jsonb "xendit_data", default: {}, null: false
    t.string "xendit_reference_id"
    t.index ["paid_at"], name: "index_finance_payments_on_paid_at"
    t.index ["space_subscription_id"], name: "index_finance_payments_on_space_subscription_id"
    t.index ["status"], name: "index_finance_payments_on_status"
    t.index ["xendit_action_id"], name: "index_finance_payments_on_xendit_action_id", unique: true
    t.index ["xendit_cycle_id"], name: "index_finance_payments_on_xendit_cycle_id"
  end

  create_table "finance_space_subscriptions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "current_cycle_count", default: 0, null: false
    t.datetime "ended_at"
    t.jsonb "metadata", default: {}, null: false
    t.uuid "space_id", null: false
    t.datetime "started_at"
    t.enum "status", default: "pending", null: false, enum_type: "finance_space_subscription_status"
    t.uuid "subscription_plan_id", null: false
    t.integer "total_cycles"
    t.datetime "updated_at", null: false
    t.string "xendit_customer_id"
    t.string "xendit_plan_id"
    t.string "xendit_schedule_id"
    t.index ["space_id", "status"], name: "index_finance_space_subscriptions_on_space_id_and_status", unique: true, where: "(status = 'active'::finance_space_subscription_status)"
    t.index ["space_id"], name: "index_finance_space_subscriptions_on_space_id"
    t.index ["status"], name: "index_finance_space_subscriptions_on_status"
    t.index ["subscription_plan_id"], name: "index_finance_space_subscriptions_on_subscription_plan_id"
    t.index ["xendit_plan_id"], name: "index_finance_space_subscriptions_on_xendit_plan_id"
  end

  create_table "finance_subscription_plans", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.text "description"
    t.string "interval", default: "month", null: false
    t.string "name", null: false
    t.bigint "price_cents", default: 0, null: false
    t.string "price_currency", default: "PHP", null: false
    t.string "slug", null: false
    t.integer "token_limit", null: false
    t.datetime "updated_at", null: false
    t.index ["active"], name: "index_finance_subscription_plans_on_active"
    t.index ["slug"], name: "index_finance_subscription_plans_on_slug", unique: true
  end

  create_table "goal_descriptions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "description"
    t.uuid "space_id", null: false
    t.datetime "updated_at", null: false
    t.index ["space_id"], name: "index_goal_descriptions_on_space_id"
  end

  create_table "import_records", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.jsonb "edited_data", default: {}
    t.jsonb "import_errors", default: []
    t.uuid "import_id", null: false
    t.jsonb "original_data", default: {}
    t.uuid "record_id"
    t.string "record_type"
    t.integer "row_number", null: false
    t.string "status", default: "pending", null: false
    t.datetime "updated_at", null: false
    t.index ["import_id", "record_type"], name: "index_import_records_on_import_id_and_record_type"
    t.index ["import_id", "status"], name: "index_import_records_on_import_id_and_status"
    t.index ["import_id"], name: "index_import_records_on_import_id"
    t.index ["record_type", "record_id"], name: "index_import_records_on_record_type_and_record_id"
  end

  create_table "imports", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.jsonb "import_errors", default: []
    t.string "import_location", null: false
    t.jsonb "metadata", default: {}
    t.datetime "processed_at"
    t.uuid "space_id", null: false
    t.string "status", default: "pending", null: false
    t.integer "total_rows_failed", default: 0
    t.integer "total_rows_inserted", default: 0
    t.integer "total_rows_read", default: 0
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["space_id", "created_at"], name: "index_imports_on_space_id_and_created_at"
    t.index ["space_id"], name: "index_imports_on_space_id"
    t.index ["status"], name: "index_imports_on_status"
    t.index ["user_id", "created_at"], name: "index_imports_on_user_id_and_created_at"
    t.index ["user_id"], name: "index_imports_on_user_id"
  end

  create_table "loan_payments", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "account_id", null: false
    t.datetime "created_at", null: false
    t.string "currency", default: "PHP", null: false
    t.date "date", null: false
    t.bigint "interest_payment_cents", null: false
    t.uuid "loan_id", null: false
    t.text "notes"
    t.bigint "principal_payment_cents", null: false
    t.bigint "total_payment_cents", null: false
    t.uuid "transaction_id"
    t.datetime "updated_at", null: false
    t.index ["account_id", "date"], name: "index_loan_payments_on_account_id_and_date"
    t.index ["account_id"], name: "index_loan_payments_on_account_id"
    t.index ["loan_id", "date"], name: "index_loan_payments_on_loan_id_and_date"
    t.index ["loan_id"], name: "index_loan_payments_on_loan_id"
    t.index ["transaction_id"], name: "index_loan_payments_on_transaction_id"
  end

  create_table "loans", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "account_id", null: false
    t.datetime "created_at", null: false
    t.string "currency", default: "PHP", null: false
    t.date "date", null: false
    t.text "description"
    t.uuid "entity_id", null: false
    t.decimal "interest_rate", precision: 5, scale: 2, null: false
    t.integer "loan_term_months", null: false
    t.string "loan_type", null: false
    t.date "maturity_date", null: false
    t.bigint "outstanding_balance_cents", null: false
    t.date "paid_off_date"
    t.bigint "principal_amount_cents", null: false
    t.uuid "space_id", null: false
    t.string "status", default: "active"
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["account_id"], name: "index_loans_on_account_id"
    t.index ["entity_id"], name: "index_loans_on_entity_id"
    t.index ["maturity_date"], name: "index_loans_on_maturity_date"
    t.index ["space_id", "loan_type"], name: "index_loans_on_space_id_and_loan_type"
    t.index ["space_id", "status"], name: "index_loans_on_space_id_and_status"
    t.index ["space_id"], name: "index_loans_on_space_id"
    t.index ["user_id"], name: "index_loans_on_user_id"
  end

  create_table "monthly_financial_summaries", force: :cascade do |t|
    t.datetime "calculated_at", null: false
    t.datetime "created_at", null: false
    t.integer "month", null: false
    t.decimal "net_savings", precision: 15, scale: 2, default: "0.0", null: false
    t.uuid "space_id", null: false
    t.decimal "total_expenses", precision: 15, scale: 2, default: "0.0", null: false
    t.decimal "total_income", precision: 15, scale: 2, default: "0.0", null: false
    t.datetime "updated_at", null: false
    t.integer "year", null: false
    t.index ["space_id", "year", "month"], name: "index_monthly_financial_summaries_on_space_year_month", unique: true
    t.index ["space_id"], name: "index_monthly_financial_summaries_on_space_id"
    t.index ["year", "month"], name: "index_monthly_financial_summaries_on_year_month"
  end

  create_table "onboardings", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.jsonb "data", default: {}
    t.enum "step", default: "income", null: false, enum_type: "onboarding_step_enum"
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["user_id"], name: "index_onboardings_on_user_id"
  end

  create_table "rag_embeddings", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.text "content", null: false
    t.datetime "created_at", null: false
    t.uuid "embeddable_id", null: false
    t.string "embeddable_type", null: false
    t.vector "embedding", limit: 1536, null: false
    t.jsonb "metadata", default: {}
    t.uuid "space_id", null: false
    t.datetime "updated_at", null: false
    t.index ["embeddable_type", "embeddable_id"], name: "index_rag_embeddings_on_embeddable_type_and_embeddable_id", unique: true
    t.index ["embedding"], name: "rag_embeddings_embedding_hnsw_idx", opclass: :vector_cosine_ops, using: :hnsw
    t.index ["space_id"], name: "index_rag_embeddings_on_space_id"
  end

  create_table "roles", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "name"
    t.uuid "resource_id"
    t.string "resource_type"
    t.datetime "updated_at", null: false
    t.index ["name", "resource_type", "resource_id"], name: "index_roles_on_name_and_resource_type_and_resource_id"
    t.index ["resource_type", "resource_id"], name: "index_roles_on_resource"
  end

  create_table "space_users", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "access_code"
    t.datetime "created_at", null: false
    t.datetime "invitation_expires_at"
    t.string "invitation_status", default: "active"
    t.datetime "invitation_used_at"
    t.uuid "invited_by_id"
    t.uuid "space_id", null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id"
    t.index ["access_code"], name: "index_space_users_on_access_code", unique: true
    t.index ["invitation_expires_at"], name: "index_space_users_on_invitation_expires_at"
    t.index ["invitation_status"], name: "index_space_users_on_invitation_status"
    t.index ["invited_by_id"], name: "index_space_users_on_invited_by_id"
    t.index ["space_id", "invitation_status"], name: "index_space_users_on_space_id_and_invitation_status"
    t.index ["space_id", "user_id"], name: "index_space_users_on_space_id_and_user_id", unique: true
    t.index ["space_id"], name: "index_space_users_on_space_id"
    t.index ["user_id"], name: "index_space_users_on_user_id"
  end

  create_table "spaces", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "code", null: false
    t.datetime "created_at", null: false
    t.string "currency", default: "PHP", null: false
    t.string "name", null: false
    t.string "type", null: false
    t.datetime "updated_at", null: false
    t.index ["code"], name: "index_spaces_on_code", unique: true
    t.index ["currency"], name: "index_spaces_on_currency"
    t.index ["type"], name: "index_spaces_on_type"
  end

  create_table "transactions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "account_id", null: false
    t.bigint "amount_cents", default: 0, null: false
    t.string "amount_currency", default: "PHP", null: false
    t.bigint "balance_cents", default: 0, null: false
    t.string "balance_currency", default: "PHP", null: false
    t.enum "balance_state", null: false, enum_type: "balance_state"
    t.uuid "category_id", null: false
    t.datetime "created_at", null: false
    t.datetime "date", null: false
    t.string "description"
    t.uuid "effective_parent_id"
    t.integer "installment_count"
    t.integer "installment_period"
    t.uuid "parent_id"
    t.integer "repeat_count"
    t.enum "repeat_interval", enum_type: "repeat_interval"
    t.jsonb "schedule", default: {}
    t.enum "schedule_type", null: false, enum_type: "schedule_type"
    t.uuid "space_id"
    t.uuid "transfer_id"
    t.string "type", null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["account_id"], name: "index_transactions_on_account_id"
    t.index ["category_id"], name: "index_transactions_on_category_id"
    t.index ["date", "type", "amount_currency", "amount_cents"], name: "idx_on_date_type_amount_currency_amount_cents_5ec151a267"
    t.index ["effective_parent_id", "date"], name: "index_transactions_on_effective_parent_id_and_date"
    t.index ["effective_parent_id"], name: "index_transactions_on_effective_parent_id"
    t.index ["parent_id", "date"], name: "index_transactions_on_parent_id_and_date"
    t.index ["parent_id"], name: "index_transactions_on_parent_id"
    t.index ["space_id"], name: "index_transactions_on_space_id"
    t.index ["transfer_id"], name: "index_transactions_on_transfer_id"
    t.index ["user_id", "date", "type"], name: "index_transactions_on_user_id_and_date_and_type"
    t.index ["user_id"], name: "index_transactions_on_user_id"
  end

  create_table "transactions_categories", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.enum "category_type", null: false, enum_type: "category_type_enum"
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.uuid "space_id", null: false
    t.datetime "updated_at", null: false
    t.index ["space_id", "category_type", "name"], name: "index_tx_categories_on_space_type_name", unique: true
    t.index ["space_id"], name: "index_transactions_categories_on_space_id"
  end

  create_table "transfers", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.bigint "amount_cents", default: 0, null: false
    t.string "amount_currency", default: "PHP", null: false
    t.enum "balance_state", default: "pending", null: false, enum_type: "balance_state"
    t.datetime "created_at", null: false
    t.datetime "date", null: false
    t.string "description"
    t.uuid "effective_parent_id"
    t.uuid "from_account_id", null: false
    t.uuid "parent_id"
    t.integer "repeat_count"
    t.enum "repeat_interval", enum_type: "repeat_interval"
    t.jsonb "schedule", default: {}
    t.enum "schedule_type", null: false, enum_type: "schedule_type"
    t.uuid "space_id", null: false
    t.uuid "to_account_id", null: false
    t.bigint "transaction_cost_cents", default: 0, null: false
    t.string "transaction_cost_currency", default: "PHP", null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["effective_parent_id", "date"], name: "index_transfers_on_effective_parent_id_and_date"
    t.index ["effective_parent_id"], name: "index_transfers_on_effective_parent_id"
    t.index ["from_account_id", "date"], name: "index_transfers_on_from_account_id_and_date"
    t.index ["from_account_id", "to_account_id"], name: "index_transfers_on_from_account_id_and_to_account_id"
    t.index ["from_account_id"], name: "index_transfers_on_from_account_id"
    t.index ["parent_id", "date"], name: "index_transfers_on_parent_id_and_date"
    t.index ["parent_id"], name: "index_transfers_on_parent_id"
    t.index ["space_id", "date"], name: "index_transfers_on_space_id_and_date"
    t.index ["space_id"], name: "index_transfers_on_space_id"
    t.index ["to_account_id", "date"], name: "index_transfers_on_to_account_id_and_date"
    t.index ["to_account_id"], name: "index_transfers_on_to_account_id"
    t.index ["user_id", "date"], name: "index_transfers_on_user_id_and_date"
    t.index ["user_id"], name: "index_transfers_on_user_id"
  end

  create_table "user_activities", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.date "activity_date", null: false
    t.integer "api_request_count", default: 0, null: false
    t.datetime "created_at", null: false
    t.integer "dashboard_viewed_count", default: 0, null: false
    t.integer "login_count", default: 0, null: false
    t.integer "total_requests", default: 0, null: false
    t.integer "transaction_created_count", default: 0, null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["activity_date"], name: "index_user_activities_on_activity_date"
    t.index ["total_requests"], name: "index_user_activities_on_total_requests"
    t.index ["user_id", "activity_date"], name: "index_user_activities_on_user_id_and_activity_date", unique: true
    t.index ["user_id"], name: "index_user_activities_on_user_id"
  end

  create_table "users", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "auth_id", null: false
    t.datetime "created_at", null: false
    t.string "email"
    t.string "full_name"
    t.string "photo_url"
    t.datetime "updated_at", null: false
    t.index ["auth_id"], name: "index_users_on_auth_id", unique: true
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  create_table "users_roles", id: false, force: :cascade do |t|
    t.uuid "role_id"
    t.uuid "user_id"
    t.index ["role_id"], name: "index_users_roles_on_role_id"
    t.index ["user_id", "role_id"], name: "index_users_roles_on_user_id_and_role_id"
    t.index ["user_id"], name: "index_users_roles_on_user_id"
  end

  add_foreign_key "accounts", "spaces"
  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "ai_conversation_messages", "ai_conversations", column: "conversation_id"
  add_foreign_key "ai_conversations", "spaces"
  add_foreign_key "ai_conversations", "users"
  add_foreign_key "ai_interactions", "spaces"
  add_foreign_key "ai_interactions", "users"
  add_foreign_key "ai_usages", "spaces"
  add_foreign_key "ai_usages", "users"
  add_foreign_key "budgets", "spaces"
  add_foreign_key "budgets", "transactions_categories", column: "category_id"
  add_foreign_key "crm_ticket_responses", "crm_tickets", column: "ticket_id"
  add_foreign_key "crm_ticket_responses", "users", column: "responder_id"
  add_foreign_key "crm_tickets", "spaces"
  add_foreign_key "crm_tickets", "users"
  add_foreign_key "entities", "spaces"
  add_foreign_key "finance_payments", "finance_space_subscriptions", column: "space_subscription_id"
  add_foreign_key "finance_space_subscriptions", "finance_subscription_plans", column: "subscription_plan_id"
  add_foreign_key "finance_space_subscriptions", "spaces"
  add_foreign_key "goal_descriptions", "spaces"
  add_foreign_key "import_records", "imports"
  add_foreign_key "imports", "spaces"
  add_foreign_key "imports", "users"
  add_foreign_key "loan_payments", "accounts"
  add_foreign_key "loan_payments", "loans"
  add_foreign_key "loan_payments", "transactions"
  add_foreign_key "loans", "accounts"
  add_foreign_key "loans", "entities"
  add_foreign_key "loans", "spaces"
  add_foreign_key "loans", "users"
  add_foreign_key "monthly_financial_summaries", "spaces"
  add_foreign_key "onboardings", "users"
  add_foreign_key "rag_embeddings", "spaces"
  add_foreign_key "space_users", "spaces"
  add_foreign_key "space_users", "users"
  add_foreign_key "space_users", "users", column: "invited_by_id"
  add_foreign_key "transactions", "accounts"
  add_foreign_key "transactions", "transactions", column: "effective_parent_id"
  add_foreign_key "transactions", "transactions", column: "parent_id"
  add_foreign_key "transactions", "transactions_categories", column: "category_id"
  add_foreign_key "transactions", "transfers"
  add_foreign_key "transactions", "users"
  add_foreign_key "transactions_categories", "spaces"
  add_foreign_key "transfers", "accounts", column: "from_account_id"
  add_foreign_key "transfers", "accounts", column: "to_account_id"
  add_foreign_key "transfers", "spaces"
  add_foreign_key "transfers", "transfers", column: "effective_parent_id"
  add_foreign_key "transfers", "transfers", column: "parent_id"
  add_foreign_key "transfers", "users"
  add_foreign_key "user_activities", "users"

  create_view "combined_transactions", sql_definition: <<-SQL
      SELECT 'Transactions::Transfer'::character varying AS transactable_type,
      transfers.id AS transactable_id,
      transfers.space_id,
      transfers.date,
      transfers.amount_cents,
      transfers.amount_currency,
      transfers.description,
      to_accounts.name AS to_account_name,
      from_accounts.name AS from_account_name,
      NULL::bigint AS balance_cents,
      NULL::character varying AS balance_currency,
      NULL::character varying AS category_name,
      NULL::uuid AS category_id,
      transfers.transaction_cost_cents,
      transfers.transaction_cost_currency,
      transfers.balance_state,
      transfers.created_at
     FROM (((transfers
       JOIN spaces ON ((spaces.id = transfers.space_id)))
       JOIN accounts to_accounts ON ((to_accounts.id = transfers.to_account_id)))
       JOIN accounts from_accounts ON ((from_accounts.id = transfers.from_account_id)))
  UNION ALL
   SELECT transactions.type AS transactable_type,
      transactions.id AS transactable_id,
      transactions.space_id,
      transactions.date,
      transactions.amount_cents,
      transactions.amount_currency,
      transactions.description,
          CASE
              WHEN ((transactions.type)::text = 'Transactions::Income'::text) THEN accounts.name
              ELSE NULL::character varying
          END AS to_account_name,
          CASE
              WHEN ((transactions.type)::text = 'Transactions::Expense'::text) THEN accounts.name
              ELSE NULL::character varying
          END AS from_account_name,
      transactions.balance_cents,
      transactions.balance_currency,
      transactions_categories.name AS category_name,
      transactions_categories.id AS category_id,
      NULL::bigint AS transaction_cost_cents,
      NULL::character varying AS transaction_cost_currency,
      transactions.balance_state,
      transactions.created_at
     FROM (((transactions
       JOIN accounts ON ((accounts.id = transactions.account_id)))
       JOIN spaces ON ((spaces.id = transactions.space_id)))
       JOIN transactions_categories ON ((transactions_categories.id = transactions.category_id)));
  SQL
end
