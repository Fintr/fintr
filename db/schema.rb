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

ActiveRecord::Schema[8.0].define(version: 2025_04_05_044308) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  # Custom types defined in this database.
  # Note that some types may not work with other database engines. Be careful if changing database.
  create_enum "expense_category", ["house", "food", "transportation", "utilities", "insurance", "family", "pet", "socials", "entertainment", "travel", "business"]
  create_enum "income_category", ["salary", "freelance", "business"]
  create_enum "transaction_essentialness", ["want", "need"]
  create_enum "transaction_type", ["income", "expense"]

  create_table "jwt_denylist", force: :cascade do |t|
    t.string "jti", null: false
    t.datetime "exp", null: false
    t.index ["jti"], name: "index_jwt_denylist_on_jti"
  end

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
    t.string "email", default: "", null: false
    t.string "encrypted_password", default: "", null: false
    t.string "reset_password_token"
    t.datetime "reset_password_sent_at"
    t.datetime "remember_created_at"
    t.integer "sign_in_count", default: 0, null: false
    t.datetime "current_sign_in_at"
    t.datetime "last_sign_in_at"
    t.string "current_sign_in_ip"
    t.string "last_sign_in_ip"
    t.string "confirmation_token"
    t.datetime "confirmed_at"
    t.datetime "confirmation_sent_at"
    t.string "unconfirmed_email"
    t.integer "failed_attempts", default: 0, null: false
    t.string "unlock_token"
    t.datetime "locked_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["confirmation_token"], name: "index_users_on_confirmation_token", unique: true
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
    t.index ["unlock_token"], name: "index_users_on_unlock_token", unique: true
  end

  add_foreign_key "transactions", "users"
end
