# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Operations::Usages::EnforceMonthlyChatLimit, type: :operation do
  subject(:operation) { described_class.new }

  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }

  it "allows a user with no chats this month" do
    result = operation.call(user_id: user.id)

    expect(result).to be_success
  end

  it "allows the 30th chat of the month" do
    create_list(
      :ai_usage,
      29,
      :ai_chat,
      user: user,
      space: space,
      created_at: Time.current,
    )

    result = operation.call(user_id: user.id)

    expect(result).to be_success
  end

  it "rejects the 31st chat of the month" do
    create_list(
      :ai_usage,
      30,
      :ai_chat,
      user: user,
      space: space,
      created_at: Time.current,
    )

    result = operation.call(user_id: user.id)

    expect(result).to be_failure
    expect(result.failure).to eq(
      message: "You have used all 30 AI chats for this month.",
    )
  end

  it "ignores chats from last month" do
    create_list(
      :ai_usage,
      30,
      :ai_chat,
      user: user,
      space: space,
      created_at: 1.month.ago,
    )

    result = operation.call(user_id: user.id)

    expect(result).to be_success
  end

  it "ignores receipt scans" do
    create_list(
      :ai_usage,
      30,
      user: user,
      space: space,
      created_at: Time.current,
    )

    result = operation.call(user_id: user.id)

    expect(result).to be_success
  end

  it "counts chats from another space for the same user" do
    other_space = create(:personal_space)
    create_list(
      :ai_usage,
      30,
      :ai_chat,
      user: user,
      space: other_space,
      created_at: Time.current,
    )

    result = operation.call(user_id: user.id)

    expect(result).to be_failure
  end
end
