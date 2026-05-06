# frozen_string_literal: true

require "rails_helper"

RSpec.describe Admin::Queries::UserActivityDrilldownQuery, type: :query do
  let(:space) { create(:space) }
  let(:day) { Date.current }
  let(:time_range) { day.in_time_zone.beginning_of_day..day.in_time_zone.end_of_day }

  it "counts only non-draft transactions" do
    user = create(:user)
    UserActivity.create!(
      user:,
      activity_date: day,
      api_request_count: 1,
      total_requests: 1,
      login_count: 0,
      dashboard_viewed_count: 0,
      transaction_created_count: 0
    )

    create(:draft_transaction, user:, space:, created_at: time_range.begin + 1.hour)
    create(:income_transaction, user:, space:, created_at: time_range.begin + 2.hours)

    result = described_class.new(params: { start_date: day, end_date: day }).call
    expect(result).to be_success

    row = result.value!.find { |r| r[:id] == user.id }
    expect(row[:transactions_created]).to eq(1)
  end

  it "separates standalone and transfer-leg transactions" do
    user = create(:user)
    UserActivity.create!(
      user:,
      activity_date: day,
      api_request_count: 1,
      total_requests: 1,
      login_count: 0,
      dashboard_viewed_count: 0,
      transaction_created_count: 0
    )

    from_account = create(:account, space: space)
    to_account = create(:account, space: space)
    transfer = create(
      :transfer,
      user:,
      space:,
      from_account:,
      to_account:,
      created_at: time_range.begin + 1.hour
    )
    create(
      :income_transaction,
      user:,
      space:,
      transfer:,
      created_at: time_range.begin + 1.hour
    )
    create(:income_transaction, user:, space:, transfer_id: nil, created_at: time_range.begin + 2.hours)

    result = described_class.new(params: { start_date: day, end_date: day }).call
    expect(result).to be_success

    row = result.value!.find { |r| r[:id] == user.id }
    expect(row[:standalone_transactions]).to eq(1)
    expect(row[:transfer_leg_transactions]).to eq(1)
    expect(row[:transactions_created]).to eq(2)
  end
end
