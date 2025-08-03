# frozen_string_literal: true

class AssignInitialAdmins < ActiveRecord::Migration[8.0]
  def up
    Rake::Task["admins:create_initial"].invoke
  end

  def down
    puts "do nothing"
  end
end
