# frozen_string_literal: true

require "rails_helper"

RSpec.describe Spaces::Operations::TransferOwnership, type: :operation do
  let(:owner) { create(:user) }
  let(:new_owner) { create(:user) }
  let(:non_member) { create(:user) }
  let(:space) { create(:organization_space, owner: owner) }

  before do
    create(:space_user, user: owner, space: space)
    create(:space_user, user: new_owner, space: space)
    owner.add_role(:admin, space)
    new_owner.add_role(:member, space)
  end

  describe "#call" do
    context "when owner transfers ownership to a member" do
      let(:valid_params) do
        {
          user_id: owner.id.to_s,
          space_id: space.id.to_s,
          new_owner_id: new_owner.id.to_s
        }
      end

      it "successfully transfers ownership" do
        result = described_class.new.call(valid_params)

        expect(result).to be_success
        expect(result.value![:message]).to eq("Ownership successfully transferred")
        expect(space.reload.owner_id).to eq(new_owner.id)
      end

      it "gives admin role to new owner" do
        described_class.new.call(valid_params)

        expect(new_owner.has_role?(:admin, space)).to be true
      end

      it "returns the space and new owner in the result" do
        result = described_class.new.call(valid_params)

        expect(result.value![:space]).to eq(space)
        expect(result.value![:new_owner]).to eq(new_owner)
      end
    end

    context "when non-owner tries to transfer ownership" do
      let(:invalid_params) do
        {
          user_id: new_owner.id.to_s,
          space_id: space.id.to_s,
          new_owner_id: owner.id.to_s
        }
      end

      it "returns failure with permission error" do
        result = described_class.new.call(invalid_params)

        expect(result).to be_failure
        expect(result.failure).to include(errors: { permission: ["Only the space owner can transfer ownership"] })
        expect(space.reload.owner_id).to eq(owner.id)
      end
    end

    context "when transferring to a non-member" do
      let(:invalid_params) do
        {
          user_id: owner.id.to_s,
          space_id: space.id.to_s,
          new_owner_id: non_member.id.to_s
        }
      end

      it "returns failure with membership error" do
        result = described_class.new.call(invalid_params)

        expect(result).to be_failure
        expect(result.failure).to include(errors: { new_owner: ["New owner must be a member of the space"] })
        expect(space.reload.owner_id).to eq(owner.id)
      end
    end

    context "with invalid user_id" do
      let(:invalid_params) do
        {
          user_id: "invalid-uuid",
          space_id: space.id.to_s,
          new_owner_id: new_owner.id.to_s
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
          space_id: "invalid-uuid",
          new_owner_id: new_owner.id.to_s
        }
      end

      it "returns failure" do
        result = described_class.new.call(invalid_params)

        expect(result).to be_failure
        expect(result.failure).to include(errors: { space: ["not found"] })
      end
    end

    context "with invalid new_owner_id" do
      let(:invalid_params) do
        {
          user_id: owner.id.to_s,
          space_id: space.id.to_s,
          new_owner_id: "invalid-uuid"
        }
      end

      it "returns failure" do
        result = described_class.new.call(invalid_params)

        expect(result).to be_failure
        expect(result.failure).to include(errors: { new_owner: ["not found"] })
      end
    end

    context "when new owner already has admin role" do
      before do
        new_owner.add_role(:admin, space)
      end

      let(:valid_params) do
        {
          user_id: owner.id.to_s,
          space_id: space.id.to_s,
          new_owner_id: new_owner.id.to_s
        }
      end

      it "still succeeds without duplicate role assignment" do
        result = described_class.new.call(valid_params)

        expect(result).to be_success
        expect(space.reload.owner_id).to eq(new_owner.id)
      end
    end
  end
end
