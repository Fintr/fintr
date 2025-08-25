# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Operations::Usages::CreateUsage, type: :operation do
  subject(:operation) { described_class.new }

  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:params) do
    {
      user_id: user.id,
      space_id: space.id,
      ai_type: "pure_ai_ocr"
    }
  end

  describe "Contract" do
    it "succeeds with valid parameters" do
      result = operation.validate(params: params)
      expect(result).to eq(params)
    end

    it "succeeds without ai_type parameter" do
      params_without_ai_type = params.except(:ai_type)
      result = operation.validate(params: params_without_ai_type)
      expect(result).to eq(params_without_ai_type)
    end

          it "fails without a user_id" do
        params_without_user_id = params.except(:user_id)
        result = operation.validate(params: params_without_user_id)
        expect(result).to be_a(Hash)
        expect(result).to have_key(:user_id)
      end

      it "fails without a space_id" do
        params_without_space_id = params.except(:space_id)
        result = operation.validate(params: params_without_space_id)
        expect(result).to be_a(Hash)
        expect(result).to have_key(:space_id)
      end

      it "fails with invalid user_id type" do
        params_with_invalid_user_id = params.merge(user_id: 123)
        result = operation.validate(params: params_with_invalid_user_id)
        expect(result).to be_a(Hash)
        expect(result).to have_key(:user_id)
      end

      it "fails with invalid space_id type" do
        params_with_invalid_space_id = params.merge(space_id: 123)
        result = operation.validate(params: params_with_invalid_space_id)
        expect(result).to be_a(Hash)
        expect(result).to have_key(:space_id)
      end
  end

  describe "#call" do
    context "when the block succeeds" do
      let(:block_result) { Dry::Monads::Result::Success.new({ data: "success" }) }
      let(:time_start) { Time.current }

      before do
        allow(Time).to receive(:current).and_return(time_start)
      end

      it "creates a usage record" do
        expect { operation.call(params) { block_result } }.to change(Ai::Usage, :count).by(1)
      end

      it "creates usage with correct attributes" do
        result = operation.call(params) { block_result }
        usage = Ai::Usage.last

        expect(usage.user_id).to eq(user.id)
        expect(usage.space_id).to eq(space.id)
        expect(usage.ai_type).to eq("pure_ai_ocr")
        expect(usage.status).to eq("success")
        expect(usage.tokens_used).to eq(1)
        expect(usage.time_seconds).to be >= 0
        expect(usage.result).to eq({})
      end

      it "returns success with block result" do
        result = operation.call(params) { block_result }
        expect(result).to be_success
        expect(result.value!).to eq({ data: "success" })
      end

      it "updates usage with success status and empty result" do
        operation.call(params) { block_result }
        usage = Ai::Usage.last

        expect(usage.status).to eq("success")
        expect(usage.result).to eq({})
      end
    end

    context "when the block fails" do
      let(:block_result) { Dry::Monads::Result::Failure.new({ error: "block failed" }) }
      let(:time_start) { Time.current }

      before do
        allow(Time).to receive(:current).and_return(time_start)
      end

      it "creates a usage record" do
        expect { operation.call(params) { block_result } }.to change(Ai::Usage, :count).by(1)
      end

      it "creates usage with correct attributes" do
        result = operation.call(params) { block_result }
        usage = Ai::Usage.last

        expect(usage.user_id).to eq(user.id)
        expect(usage.space_id).to eq(space.id)
        expect(usage.ai_type).to eq("pure_ai_ocr")
        expect(usage.status).to eq("failure")
        expect(usage.tokens_used).to eq(1)
        expect(usage.time_seconds).to be >= 0
        expect(usage.result).to eq({ "error" => "block failed" })
      end

      it "returns failure with block result" do
        result = operation.call(params) { block_result }
        expect(result).to be_failure
        expect(result.failure).to eq({ error: "block failed" })
      end

      it "updates usage with failure status and block failure result" do
        operation.call(params) { block_result }
        usage = Ai::Usage.last

        expect(usage.status).to eq("failure")
        expect(usage.result).to eq({ "error" => "block failed" })
      end
    end

    context "when an exception occurs" do
      let(:exception) { StandardError.new("Something went wrong") }
      let(:time_start) { Time.current }

      before do
        allow(Time).to receive(:current).and_return(time_start)
      end

      it "creates a usage record" do
        expect do
          operation.call(params) { raise exception }
        rescue StandardError
          nil
        end.to change(Ai::Usage, :count).by(1)
      end

      it "creates usage with failure status and exception details" do
        begin
          operation.call(params) { raise exception }
        rescue StandardError
          nil
        end

        usage = Ai::Usage.last
        expect(usage.user_id).to eq(user.id)
        expect(usage.space_id).to eq(space.id)
        expect(usage.ai_type).to eq("pure_ai_ocr")
        expect(usage.status).to eq("failure")
        expect(usage.tokens_used).to eq(1)
        expect(usage.time_seconds).to be >= 0
        expect(usage.result).to include("Something went wrong")
      end

      it "returns failure with exception" do
        result = operation.call(params) { raise exception }
        expect(result).to be_failure
        expect(result.failure).to eq(exception)
      end

      it "updates usage with failure status and exception JSON" do
        operation.call(params) { raise exception }
        usage = Ai::Usage.last

        expect(usage.status).to eq("failure")
        expect(usage.result).to include("Something went wrong")
      end
    end

    context "when ai_type is not provided" do
      let(:params_without_ai_type) { params.except(:ai_type) }
      let(:block_result) { Dry::Monads::Result::Success.new({ data: "success" }) }

      it "uses default ai_type" do
        operation.call(params_without_ai_type) { block_result }
        usage = Ai::Usage.last

        expect(usage.ai_type).to eq("pure_ai_ocr")
      end
    end

    context "when custom ai_type is provided" do
      let(:params_with_custom_ai_type) { params.merge(ai_type: "ai_chat") }
      let(:block_result) { Dry::Monads::Result::Success.new({ data: "success" }) }

      it "uses the provided ai_type" do
        operation.call(params_with_custom_ai_type) { block_result }
        usage = Ai::Usage.last

        expect(usage.ai_type).to eq("ai_chat")
      end
    end
  end

  describe "private methods" do
    describe "#create_usage" do
      it "creates a usage record with correct attributes" do
        usage = operation.send(:create_usage, params: params)

        expect(usage).to be_a(Ai::Usage)
        expect(usage.user_id).to eq(user.id)
        expect(usage.space_id).to eq(space.id)
        expect(usage.ai_type).to eq("pure_ai_ocr")
        expect(usage.status).to eq("pending")
        expect(usage.tokens_used).to eq(1)
        expect(usage.time_seconds).to eq(0.0)
        expect(usage.result).to eq({})
      end

      it "uses default ai_type when not provided" do
        params_without_ai_type = params.except(:ai_type)
        usage = operation.send(:create_usage, params: params_without_ai_type)

        expect(usage.ai_type).to eq("pure_ai_ocr")
      end
    end

    describe "#transform_result" do
      let(:usage) { create(:ai_usage, user: user, space: space) }
      let(:time_start) { Time.current }

      before do
        allow(Time).to receive(:current).and_return(time_start)
      end

      context "when result is success" do
        let(:success_result) { Dry::Monads::Result::Success.new({ data: "success" }) }

        it "updates usage with success status and empty result" do
          result = operation.send(:transform_result, success_result, usage: usage, time_start: time_start)

          expect(result).to be_success
          expect(result.value!).to eq({ data: "success" })
          expect(usage.reload.status).to eq("success")
          expect(usage.result).to eq({})
        end
      end

      context "when result is failure" do
        let(:failure_result) { Dry::Monads::Result::Failure.new({ error: "failed" }) }

        it "updates usage with failure status and failure result" do
          result = operation.send(:transform_result, failure_result, usage: usage, time_start: time_start)

          expect(result).to be_failure
          expect(result.failure).to eq({ error: "failed" })
          expect(usage.reload.status).to eq("failure")
          expect(usage.result).to eq({ "error" => "failed" })
        end
      end
    end

    describe "#update_usage" do
      let(:usage) { create(:ai_usage, user: user, space: space) }
      let(:time_start) { Time.current - 5.seconds }

      before do
        allow(Time).to receive(:current).and_return(Time.current)
      end

      it "updates usage with correct attributes" do
        result = operation.send(:update_usage, usage: usage, time_start: time_start, status: :success, result: { data: "test" })

        expect(result).to be(true)
        usage.reload
        expect(usage.time_seconds).to be_within(0.1).of(5.0)
        expect(usage.status).to eq("success")
        expect(usage.result).to eq({ "data" => "test" })
      end

      it "uses default status when not provided" do
        result = operation.send(:update_usage, usage: usage, time_start: time_start, result: { data: "test" })

        expect(result).to be(true)
        usage.reload
        expect(usage.status).to eq("success")
      end

      it "uses empty result when not provided" do
        result = operation.send(:update_usage, usage: usage, time_start: time_start, status: :success)

        expect(result).to be(true)
        usage.reload
        expect(usage.result).to eq({})
      end
    end
  end
end
