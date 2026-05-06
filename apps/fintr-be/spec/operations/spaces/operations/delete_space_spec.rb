# frozen_string_literal: true

require "rails_helper"

RSpec.describe Spaces::Operations::DeleteSpace, type: :operation do
  let(:owner) { create(:user) }
  let(:other_user) { create(:user) }
  let(:space) { create(:organization_space, owner: owner) }

  before do
    create(:space_user, user: owner, space: space)
    owner.add_role(:admin, space)
  end

  describe "#call" do
    context "when owner deletes the space" do
      let(:valid_params) do
        {
          user_id: owner.id.to_s,
          space_id: space.id.to_s
        }
      end

      it "successfully deletes the space" do
        result = described_class.new.call(valid_params)

        expect(result).to be_success
        expect(result.value![:message]).to eq("Space successfully deleted")
        expect(Spaces::Space.find_by(id: space.id)).to be_nil
      end

      it "deletes associated space_users" do
        expect { described_class.new.call(valid_params) }
          .to change { Spaces::SpaceUser.where(space_id: space.id).count }.to(0)
      end
    end

    context "when non-owner tries to delete the space" do
      before do
        create(:space_user, user: other_user, space: space)
      end

      let(:invalid_params) do
        {
          user_id: other_user.id.to_s,
          space_id: space.id.to_s
        }
      end

      it "returns failure with permission error" do
        result = described_class.new.call(invalid_params)

        expect(result).to be_failure
        expect(result.failure).to include(errors: { permission: ["Only the space owner can delete this space"] })
        expect(Spaces::Space.find_by(id: space.id)).to be_present
      end
    end

    context "with invalid user_id" do
      let(:invalid_params) do
        {
          user_id: "invalid-uuid",
          space_id: space.id.to_s
        }
      end

      it "returns failure" do
        result = described_class.new.call(invalid_params)

        expect(result).to be_failure
        expect(result.failure).to include(errors: { user: ["not found"] })
      end
    end

    context "with invalid space_id" do
      let(:invalid_params) do
        {
          user_id: owner.id.to_s,
          space_id: "invalid-uuid"
        }
      end

      it "returns failure" do
        result = described_class.new.call(invalid_params)

        expect(result).to be_failure
        expect(result.failure).to include(errors: { space: ["not found"] })
      end
    end

    context "when space has no owner" do
      let(:space_without_owner) { create(:organization_space, owner: nil) }
      let(:params) do
        {
          user_id: owner.id.to_s,
          space_id: space_without_owner.id.to_s
        }
      end

      before do
        create(:space_user, user: owner, space: space_without_owner)
        owner.add_role(:admin, space_without_owner)
      end


      it "returns failure as no one is the owner" do
        result = described_class.new.call(params)

        expect(result).to be_failure
        expect(result.failure).to include(errors: { permission: ["Only the space owner can delete this space"] })
      end
    end
  end
end
