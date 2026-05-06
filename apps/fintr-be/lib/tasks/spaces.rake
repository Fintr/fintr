# frozen_string_literal: true

namespace :spaces do
  desc "Backfill owner_id for existing spaces based on first admin user"
  task backfill_owner_id: :environment do
    puts "Starting owner_id backfill for spaces..."

    spaces_without_owner = Spaces::Space.where(owner_id: nil)
    total = spaces_without_owner.count
    updated = 0
    skipped = 0

    puts "Found #{total} spaces without owner_id"

    spaces_without_owner.find_each do |space|
      # Find the first user with admin role for this space
      admin_role = Auth::Role.find_by(name: "admin", resource_type: "Spaces::Space", resource_id: space.id)

      if admin_role.nil?
        puts "  [SKIP] Space #{space.id} (#{space.name}): No admin role found"
        skipped += 1
        next
      end

      # Get user from users_roles join table
      user_role = ActiveRecord::Base.connection.execute(
        "SELECT user_id FROM users_roles WHERE role_id = '#{admin_role.id}' LIMIT 1"
      ).first

      if user_role.nil?
        puts "  [SKIP] Space #{space.id} (#{space.name}): No user assigned to admin role"
        skipped += 1
        next
      end

      user = Auth::User.find_by(id: user_role["user_id"])

      if user.nil?
        puts "  [SKIP] Space #{space.id} (#{space.name}): User #{user_role['user_id']} not found"
        skipped += 1
        next
      end

      space.update_column(:owner_id, user.id)
      puts "  [OK] Space #{space.id} (#{space.name}): Set owner to #{user.email}"
      updated += 1
    end

    puts "\nBackfill complete!"
    puts "  Updated: #{updated}"
    puts "  Skipped: #{skipped}"
    puts "  Total:   #{total}"
  end

  desc "List spaces and their owners"
  task list_owners: :environment do
    puts "Spaces and their owners:"
    puts "-" * 80

    Spaces::Space.includes(:owner).find_each do |space|
      owner_info = space.owner ? "#{space.owner.email} (#{space.owner.id})" : "NO OWNER"
      puts "#{space.id} | #{space.name.truncate(30)} | #{space.type} | Owner: #{owner_info}"
    end
  end
end
