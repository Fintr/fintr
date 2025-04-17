# frozen_string_literal: true

require 'rails_helper'

RSpec.describe SpaceUser, type: :model do
  let(:user) { create(:user) }

  describe 'associations' do
    it { is_expected.to belong_to(:space) }
    it { is_expected.to belong_to(:user) }
  end

  describe 'validations' do
    # Remove the old validation test - the custom validation handles the logic now.
    # The DB index `[:space_id, :user_id], unique: true` still prevents exact duplicates.
    # it { should validate_uniqueness_of(:space_id).scoped_to(:user_id) }

    context 'custom validation: user_can_only_have_one_of_each_space_type' do
      # Use the named factories :personal_space and :organization_space
      let!(:personal_space) { create(:personal_space) }
      let!(:organization_space) { create(:organization_space) }


      it 'allows a user to join one personal space' do
        space_user = build(:space_user, user: user, space: personal_space)
        expect(space_user).to be_valid
      end

      it 'allows a user to join one organization space' do
        space_user = build(:space_user, user: user, space: organization_space)
        expect(space_user).to be_valid
      end

      it 'allows a user to join one personal and one organization space' do
        create(:space_user, user: user, space: personal_space) # Join first
        second_space_user = build(:space_user, user: user, space: organization_space)
        expect(second_space_user).to be_valid
      end

      it 'prevents a user from joining a second personal space' do
        create(:space_user, user: user, space: personal_space) # Join first
        another_personal_space = create(:personal_space)
        space_user = build(:space_user, user: user, space: another_personal_space)
        expect(space_user).not_to be_valid
        expect(space_user.errors[:user_id]).to include('already belongs to a personal space')
      end

      it 'prevents a user from joining a second organization space' do
        create(:space_user, user: user, space: organization_space) # Join first
        # Create another organization space using the named factory
        another_org_space = create(:organization_space)
        space_user = build(:space_user, user: user, space: another_org_space)
        expect(space_user).not_to be_valid
        expect(space_user.errors[:user_id]).to include('already belongs to a organization space')
      end

      it 'does not affect different users' do
        create(:space_user, user: user, space: personal_space)
        another_user = create(:user)
        # Use the existing personal_space for the other user
        space_user_for_another_user = build(:space_user, user: another_user, space: personal_space)
        expect(space_user_for_another_user).to be_valid
      end
    end
  end
end
