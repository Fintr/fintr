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

ActiveRecord::Schema[8.0].define(version: 2025_08_03_114923) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"
  enable_extension "pgcrypto"

  # Custom types defined in this database.
  # Note that some types may not work with other database engines. Be careful if changing database.
  create_enum "account_category", ["cash", "savings", "debit", "credit_card", "e_wallet", "loan", "investment"]
  create_enum "balance_state", ["pending", "calculated"]
  create_enum "category_type_enum", ["income", "expense"]
  create_enum "repeat_interval", ["every_day", "every_week", "every_2_weeks", "every_month", "every_2_months", "every_3_months", "every_6_months", "every_year"]
  create_enum "schedule_type", ["one_time", "repeat", "installment"]

  create_table "accounts", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "space_id", null: false
    t.string "name", null: false
    t.integer "balance_cents", default: 0, null: false
    t.string "balance_currency", default: "USD", null: false
    t.enum "account_category", null: false, enum_type: "account_category"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.datetime "discarded_at"
    t.index ["discarded_at"], name: "index_accounts_on_discarded_at"
    t.index ["space_id", "name"], name: "index_accounts_on_space_id_and_name_where_not_discarded", unique: true, where: "(discarded_at IS NULL)"
    t.index ["space_id"], name: "index_accounts_on_space_id"
  end

  create_table "active_storage_attachments", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "name", null: false
    t.string "record_type", null: false
    t.uuid "record_id", null: false
    t.uuid "blob_id", null: false
    t.datetime "created_at", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "key", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.text "metadata"
    t.string "service_name", null: false
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.datetime "created_at", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "beta_whitelists", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "email", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_beta_whitelists_on_email", unique: true
  end

  create_table "budgets", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "space_id", null: false
    t.uuid "category_id", null: false
    t.integer "amount_cents", default: 0, null: false
    t.string "amount_currency", default: "USD", null: false
    t.integer "spent_cents", default: 0, null: false
    t.string "spent_currency", default: "USD", null: false
    t.date "date", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["amount_cents", "amount_currency"], name: "index_budgets_on_amount_cents_and_amount_currency"
    t.index ["category_id"], name: "index_budgets_on_category_id"
    t.index ["space_id", "category_id", "date"], name: "index_budgets_on_space_id_and_category_id_and_date", unique: true
    t.index ["space_id"], name: "index_budgets_on_space_id"
    t.index ["spent_cents", "spent_currency"], name: "index_budgets_on_spent_cents_and_spent_currency"
  end

  create_table "goal_descriptions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.text "description"
    t.uuid "space_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["space_id"], name: "index_goal_descriptions_on_space_id"
  end

  create_table "roles", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "name"
    t.string "resource_type"
    t.uuid "resource_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["name", "resource_type", "resource_id"], name: "index_roles_on_name_and_resource_type_and_resource_id"
    t.index ["resource_type", "resource_id"], name: "index_roles_on_resource"
  end

  create_table "space_users", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "space_id", null: false
    t.uuid "user_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["space_id", "user_id"], name: "index_space_users_on_space_id_and_user_id", unique: true
    t.index ["space_id"], name: "index_space_users_on_space_id"
    t.index ["user_id"], name: "index_space_users_on_user_id"
  end

  create_table "spaces", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "name", null: false
    t.string "code", null: false
    t.string "currency", default: "PHP", null: false
    t.string "type", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["code"], name: "index_spaces_on_code", unique: true
    t.index ["currency"], name: "index_spaces_on_currency"
    t.index ["type"], name: "index_spaces_on_type"
  end

  create_table "transactions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.uuid "parent_id"
    t.uuid "effective_parent_id"
    t.datetime "date", null: false
    t.integer "amount_cents", default: 0, null: false
    t.string "amount_currency", default: "USD", null: false
    t.integer "balance_cents", default: 0, null: false
    t.string "balance_currency", default: "USD", null: false
    t.string "description"
    t.string "type", null: false
    t.enum "schedule_type", null: false, enum_type: "schedule_type"
    t.enum "repeat_interval", enum_type: "repeat_interval"
    t.enum "balance_state", null: false, enum_type: "balance_state"
    t.integer "repeat_count"
    t.integer "installment_period"
    t.integer "installment_count"
    t.jsonb "schedule", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.uuid "space_id"
    t.uuid "category_id", null: false
    t.uuid "account_id", null: false
    t.uuid "transfer_id"
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
    t.uuid "space_id", null: false
    t.string "name", null: false
    t.enum "category_type", null: false, enum_type: "category_type_enum"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["space_id", "category_type", "name"], name: "index_tx_categories_on_space_type_name", unique: true
    t.index ["space_id"], name: "index_transactions_categories_on_space_id"
  end

  create_table "transfers", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.uuid "space_id", null: false
    t.uuid "from_account_id", null: false
    t.uuid "to_account_id", null: false
    t.uuid "parent_id"
    t.uuid "effective_parent_id"
    t.integer "amount_cents", default: 0, null: false
    t.string "amount_currency", default: "USD", null: false
    t.integer "transaction_cost_cents", default: 0, null: false
    t.string "transaction_cost_currency", default: "USD", null: false
    t.datetime "date", null: false
    t.string "description"
    t.jsonb "schedule", default: {}
    t.enum "schedule_type", null: false, enum_type: "schedule_type"
    t.enum "repeat_interval", enum_type: "repeat_interval"
    t.integer "repeat_count"
    t.enum "balance_state", default: "pending", null: false, enum_type: "balance_state"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
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

  create_table "users", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "auth_id", null: false
    t.string "full_name"
    t.string "email"
    t.string "photo_url"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["auth_id"], name: "index_users_on_auth_id", unique: true
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  create_table "users_roles", id: false, force: :cascade do |t|
    t.uuid "user_id"
    t.uuid "role_id"
    t.index ["role_id"], name: "index_users_roles_on_role_id"
    t.index ["user_id", "role_id"], name: "index_users_roles_on_user_id_and_role_id"
    t.index ["user_id"], name: "index_users_roles_on_user_id"
  end

  add_foreign_key "accounts", "spaces"
  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "budgets", "spaces"
  add_foreign_key "budgets", "transactions_categories", column: "category_id"
  add_foreign_key "goal_descriptions", "spaces"
  add_foreign_key "space_users", "spaces"
  add_foreign_key "space_users", "users"
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
      NULL::integer AS balance_cents,
      NULL::character varying AS balance_currency,
      NULL::character varying AS category_name,
      NULL::uuid AS category_id,
      transfers.transaction_cost_cents,
      transfers.transaction_cost_currency,
      transfers.balance_state
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
      NULL::integer AS transaction_cost_cents,
      NULL::character varying AS transaction_cost_currency,
      transactions.balance_state
     FROM (((transactions
       JOIN accounts ON ((accounts.id = transactions.account_id)))
       JOIN spaces ON ((spaces.id = transactions.space_id)))
       JOIN transactions_categories ON ((transactions_categories.id = transactions.category_id)));
  SQL
end
