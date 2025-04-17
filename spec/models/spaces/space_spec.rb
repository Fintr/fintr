# frozen_string_literal: true

require 'rails_helper'

# Update describe block to use the namespaced class
RSpec.describe Spaces::Space, type: :model do
  # Subject might need adjustment if factory name changes
  # Assuming factory is updated or aliased, otherwise use create(:'spaces/space')
  subject { create(:space) }

  # Associations might need class_name specified if not inferred
  describe 'associations' do
    it { is_expected.to have_many(:transactions).dependent(:destroy).class_name('Transactions::Transaction') }
    it { is_expected.to have_many(:space_users).dependent(:destroy) }
    it { is_expected.to have_many(:users).through(:space_users) }
    it { is_expected.to have_many(:categories).dependent(:destroy).class_name('Transactions::Category') }
  end

  describe 'validations' do
    it { is_expected.to validate_presence_of(:name) }
    it { is_expected.to validate_presence_of(:code) }
    # Uniqueness validation needs a persisted subject
    it { is_expected.to validate_uniqueness_of(:code) }
    it { is_expected.to validate_presence_of(:currency) }
    it { is_expected.to validate_presence_of(:type) }
    it { is_expected.to validate_inclusion_of(:type).in_array(%w[Spaces::PersonalSpace Spaces::OrganizationSpace]) }
  end

  # Add specs for callbacks/methods if needed
end
