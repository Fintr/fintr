# frozen_string_literal: true

module Finance
  class BillingCycleSerializer < Blueprinter::Base
    identifier :id

    field :cycle_number, name: :cycleNumber do |cycle|
      # Format cycle_number: whole numbers display as "1", decimals rounded to 1 decimal place (e.g., "1.1")
      cycle_number = cycle.cycle_number.to_f.round(1)
      cycle_number == cycle_number.to_i ? cycle_number.to_i : cycle_number
    end
    field :status
    field :action_url, name: :actionUrl
    field :started_at, name: :startedAt do |cycle|
      cycle.started_at&.iso8601
    end
    field :ends_at, name: :endsAt do |cycle|
      cycle.ends_at&.iso8601
    end
    field :paid_at, name: :paidAt do |cycle|
      cycle.paid_at&.iso8601
    end
    field :scheduled_timestamp, name: :scheduledTimestamp do |cycle|
      cycle.scheduled_timestamp&.iso8601
    end
    field :tokens_allocated, name: :tokensAllocated
    field :xendit_cycle_id, name: :xenditCycleId
  end
end
