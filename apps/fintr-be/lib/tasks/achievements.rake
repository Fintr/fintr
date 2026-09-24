# frozen_string_literal: true

namespace :achievements do
  desc "Backfill achievement badges for all users based on historical activity"
  task backfill: :environment do
    total = 0
    unlocked_total = 0

    Auth::User.find_each do |user|
      result = Achievements::Operations::BackfillUser.new.call(
        user_id: user.id,
        force: ENV["FORCE"] == "1",
      )
      next unless result.success?

      count = result.value!.size
      unlocked_total += count
      total += 1
      puts "user=#{user.email} unlocked=#{count}" if count.positive?
    end

    puts "Backfilled #{total} users (#{unlocked_total} new unlocks)."
  end
end
