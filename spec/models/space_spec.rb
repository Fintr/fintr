# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Space, type: :model do
  # Create a subject for uniqueness validation test
  subject { create(:space) } # Assumes :space factory exists (like the one in spec/factories/spaces_factory.rb)

  describe 'associations' do
    it { is_expected.to have_many(:transactions).dependent(:destroy) }
    it { is_expected.to have_many(:space_users).dependent(:destroy) }
    it { is_expected.to have_many(:users).through(:space_users) }
  end

  describe 'validations' do
    it { is_expected.to validate_presence_of(:name) }

    # Test uniqueness validation (requires subject from create)
    it { is_expected.to validate_presence_of(:code) }
    it { is_expected.to validate_uniqueness_of(:code) }

    it { is_expected.to validate_presence_of(:currency) }

    it { is_expected.to validate_presence_of(:type) }
    it { is_expected.to validate_inclusion_of(:type).in_array(%w[Spaces::PersonalSpace Spaces::OrganizationSpace]) }
  end
end
