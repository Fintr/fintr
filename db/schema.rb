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

  create_table "transactions", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.date "date", null: false
    t.integer "amount_cents", default: 0, null: false
    t.string "amount_currency", default: "USD", null: false
    t.integer "balance_cents", default: 0, null: false
    t.string "balance_currency", default: "USD", null: false
    t.string "description"
    t.string "type"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["type", "date", "amount_cents"], name: "index_transactions_on_type_and_date_and_amount_cents"
    t.index ["type", "date", "balance_cents"], name: "index_transactions_on_type_and_date_and_balance_cents"
    t.index ["user_id", "date", "type"], name: "index_transactions_on_user_id_and_date_and_type"
    t.index ["user_id"], name: "index_transactions_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "auth_id", null: false
    t.string "full_name"
    t.string "email"
    t.string "photo_url"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["auth_id"], name: "index_users_on_auth_id", unique: true
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  add_foreign_key "transactions", "users"
end
