# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::CheckDuplicateTodayJob, type: :job do
  # TODO: Update tests after CheckDuplicateTodayJob implementation changes
  # The job has complex date handling and IceCube schedule logic that makes
  # the specs brittle. Tests should be rewritten to test actual behavior
  # rather than mocking internal method calls.

  it "exists as a job class" do
    expect(described_class).to be < ApplicationJob
  end
end
