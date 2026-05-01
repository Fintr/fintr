# frozen_string_literal: true

require "rails_helper"

RSpec.describe Admin::Queries::MonthlyActiveUserOcrStatsQuery, type: :query do
  let(:space) { create(:space) }
  let(:month_start) { Date.new(2026, 3, 1) }
  let(:month_end) { month_start.end_of_month }

  it "counts users with 15+ active days and sums OCR tokens for that month only" do
    user = create(:user)
    15.times do |i|
      UserActivity.create!(
        user:,
        activity_date: month_start + i.days,
        api_request_count: 1,
        total_requests: 1,
        login_count: 0,
        dashboard_viewed_count: 0,
        transaction_created_count: 0
      )
    end

    create(
      :ai_usage,
      :success,
      user:,
      space:,
      ai_type: "pure_ai_ocr",
      tokens_used: 12,
      created_at: month_start.in_time_zone + 2.days
    )
    create(
      :ai_usage,
      :success,
      user:,
      space:,
      ai_type: "pure_ai_ocr",
      tokens_used: 8,
      created_at: month_start.in_time_zone + 10.days
    )

    result = described_class.new(
      params: {
        start_date: month_start,
        end_date: month_end
      }
    ).call

    expect(result).to be_success
    bundle = result.value!
    row = bundle[:monthly_active_user_ocr].find { |r| r[:month] == month_start.to_s }
    expect(row[:active_user_count]).to eq(1)
    expect(row[:total_ocr_tokens]).to eq(20)
    expect(row[:average_ocr_tokens_per_active_user]).to eq(20.0)
    meta = bundle[:monthly_active_user_ocr_meta]
    expect(meta[:total_count]).to eq(1)
    expect(meta[:page]).to eq(1)
    expect(meta[:per_page]).to eq(12)
    expect(meta[:total_pages]).to eq(1)
  end

  it "excludes users with fewer than 15 active days in the month" do
    user = create(:user)
    10.times do |i|
      UserActivity.create!(
        user:,
        activity_date: month_start + i.days,
        api_request_count: 1,
        total_requests: 1,
        login_count: 0,
        dashboard_viewed_count: 0,
        transaction_created_count: 0
      )
    end

    create(
      :ai_usage,
      :success,
      user:,
      space:,
      ai_type: "pure_ai_ocr",
      tokens_used: 100,
      created_at: month_start.in_time_zone + 1.day
    )

    result = described_class.new(
      params: {
        start_date: month_start,
        end_date: month_end
      }
    ).call

    expect(result).to be_success
    row = result.value![:monthly_active_user_ocr].find { |r| r[:month] == month_start.to_s }
    expect(row[:active_user_count]).to eq(0)
    expect(row[:total_ocr_tokens]).to eq(0)
  end

  it "paginates month rows while summary reflects the full range" do
    range_start = Date.new(2025, 1, 1)
    range_end = Date.new(2026, 12, 31)

    result = described_class.new(
      params: {
        start_date: range_start,
        end_date: range_end,
        page: 2,
        per_page: 12
      }
    ).call

    expect(result).to be_success
    bundle = result.value!
    expect(bundle[:monthly_active_user_ocr].size).to eq(12)
    meta = bundle[:monthly_active_user_ocr_meta]
    expect(meta[:page]).to eq(2)
    expect(meta[:per_page]).to eq(12)
    expect(meta[:total_count]).to eq(24)
    expect(meta[:total_pages]).to eq(2)
    expect(bundle[:monthly_active_user_ocr].first[:month]).to eq(Date.new(2026, 1, 1).to_s)
    expect(bundle[:ocr_active_user_summary][:months_in_range]).to eq(24)
  end
end
