# frozen_string_literal: true

puts "Seeding achievements catalog..."

count = Achievements::Catalog.sync!

puts "Seeded #{count} achievements (grouped and chronological)."
