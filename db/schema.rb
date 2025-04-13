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

ActiveRecord::Schema[8.0].define(version: 2025_04_13_063131) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  # Custom types defined in this database.
  # Note that some types may not work with other database engines. Be careful if changing database.
  create_enum "expense_category", ["house", "food", "transportation", "utilities", "insurance", "family", "pet", "socials", "entertainment", "travel", "business"]
  create_enum "income_category", ["salary", "freelance", "business"]
  create_enum "transaction_essentialness", ["want", "need"]
  create_enum "transaction_type", ["income", "expense"]

  create_table "transactions", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.date "date", null: false
    t.decimal "amount", precision: 15, scale: 2, null: false
    t.decimal "balance", precision: 15, scale: 2, null: false
    t.string "description"
    t.enum "transaction_type", null: false, enum_type: "transaction_type"
    t.enum "expense_category", enum_type: "expense_category"
    t.enum "income_category", enum_type: "income_category"
    t.enum "essentialness", default: "want", null: false, enum_type: "transaction_essentialness"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["transaction_type", "expense_category"], name: "index_transactions_on_transaction_type_and_expense_category"
    t.index ["transaction_type", "income_category"], name: "index_transactions_on_transaction_type_and_income_category"
    t.index ["user_id", "date", "transaction_type"], name: "index_transactions_on_user_id_and_date_and_transaction_type"
    t.index ["user_id"], name: "index_transactions_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "auth_id", null: false
    t.string "full_name"
    t.string "email"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["auth_id"], name: "index_users_on_auth_id", unique: true
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  add_foreign_key "transactions", "users"
end
