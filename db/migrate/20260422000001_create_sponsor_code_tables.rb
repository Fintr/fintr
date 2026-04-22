# frozen_string_literal: true

class CreateSponsorCodeTables < ActiveRecord::Migration[8.1]
  def change
    # Create sponsor_codes table
    create_table :finance_sponsor_codes, id: :uuid do |t|
      t.string :code, null: false
      t.string :name, null: false
      t.text :description
      t.integer :discount_percentage
      t.bigint :discount_amount_cents
      t.string :discount_currency, default: "PHP"
      t.integer :max_uses
      t.integer :current_uses, default: 0, null: false
      t.boolean :active, default: true, null: false
      t.datetime :expires_at
      t.references :created_by, type: :uuid, foreign_key: { to_table: :users }, null: false
      t.timestamps
    end

    add_index :finance_sponsor_codes, :code, unique: true
    add_index :finance_sponsor_codes, :active

    # Create user_sponsor_codes table
    create_table :finance_user_sponsor_codes, id: :uuid do |t|
      t.references :sponsor_code, type: :uuid, foreign_key: { to_table: :finance_sponsor_codes }, null: false
      t.references :user, type: :uuid, foreign_key: true, null: false
      t.references :space_subscription, type: :uuid, foreign_key: { to_table: :finance_space_subscriptions }, null: false
      t.integer :discount_percentage_applied
      t.bigint :discount_amount_cents_applied
      t.timestamps
    end

    add_index :finance_user_sponsor_codes, [:sponsor_code_id, :user_id], unique: true
    add_index :finance_user_sponsor_codes, :user_id
    add_index :finance_user_sponsor_codes, :space_subscription_id

    # Add sponsor_code reference to space_subscriptions
    add_reference :finance_space_subscriptions, :sponsor_code, type: :uuid, foreign_key: { to_table: :finance_sponsor_codes }, null: true
    add_index :finance_space_subscriptions, :sponsor_code_id
  end
end
