# frozen_string_literal: true

FactoryBot.define do
  factory :import_record, class: "Imports::ImportRecord" do
    association :import, factory: :import
    row_number { 1 }
    status { "pending" }
    original_data { {} }
    edited_data { {} }
    import_errors { [] }
    record_type { nil }
    record_id { nil }

    trait :success do
      status { "success" }
      record_type { "Transactions::Transaction" }
      record_id { SecureRandom.uuid }
    end

    trait :failed do
      status { "failed" }
      import_errors { ["Error message"] }
    end

    trait :edited do
      status { "edited" }
      edited_data { { "amount" => 100.0 } }
    end

    trait :pending do
      status { "pending" }
    end
  end
end
