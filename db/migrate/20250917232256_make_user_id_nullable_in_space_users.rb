# frozen_string_literal: true

class MakeUserIdNullableInSpaceUsers < ActiveRecord::Migration[8.0]
  def change
    change_column_null :space_users, :user_id, true
  end
end
