# frozen_string_literal: true

require "rails_helper"

RSpec.describe Integrations::Payments::Xendit::Error do
  describe "#initialize" do
    context "with message only" do
      it "creates error with message" do
        error = described_class.new(message: "Test error")

        expect(error.message).to eq("Test error")
        expect(error.status).to be_nil
        expect(error.code).to be_nil
        expect(error.xendit_response).to be_nil
      end
    end

    context "with message and status" do
      it "creates error with message and status" do
        error = described_class.new(message: "Test error", status: 404)

        expect(error.message).to eq("Test error")
        expect(error.status).to eq(404)
        expect(error.code).to be_nil
        expect(error.xendit_response).to be_nil
      end
    end

    context "with message, status, and code" do
      it "creates error with all attributes" do
        error = described_class.new(
          message: "Test error",
          status: 400,
          code: "INVALID_REQUEST"
        )

        expect(error.message).to eq("Test error")
        expect(error.status).to eq(400)
        expect(error.code).to eq("INVALID_REQUEST")
        expect(error.xendit_response).to be_nil
      end
    end

    context "with all parameters including xendit_response" do
      it "creates error with all attributes including response" do
        xendit_response = { "error" => "Invalid request", "error_code" => "INVALID_REQUEST" }
        error = described_class.new(
          message: "Test error",
          status: 400,
          code: "INVALID_REQUEST",
          xendit_response: xendit_response
        )

        expect(error.message).to eq("Test error")
        expect(error.status).to eq(400)
        expect(error.code).to eq("INVALID_REQUEST")
        expect(error.xendit_response).to eq(xendit_response)
      end
    end
  end

  describe ".from_response" do
    context "with hash response body containing message" do
      it "creates error from hash with message" do
        response_body = {
          "message" => "Customer not found",
          "error_code" => "CUSTOMER_NOT_FOUND"
        }
        status = 404

        error = described_class.from_response(response_body: response_body, status: status)

        expect(error.message).to eq("Customer not found")
        expect(error.status).to eq(404)
        expect(error.code).to eq("CUSTOMER_NOT_FOUND")
        expect(error.xendit_response).to eq(response_body)
      end
    end

    context "with hash response body containing error" do
      it "creates error from hash with error field" do
        response_body = {
          "error" => "Invalid request",
          "code" => "INVALID_REQUEST"
        }
        status = 400

        error = described_class.from_response(response_body: response_body, status: status)

        expect(error.message).to eq("Invalid request")
        expect(error.status).to eq(400)
        expect(error.code).to eq("INVALID_REQUEST")
        expect(error.xendit_response).to eq(response_body)
      end
    end

    context "with JSON string response body" do
      it "parses JSON string and creates error" do
        response_body = '{"message": "API error", "error_code": "API_ERROR"}'
        status = 500

        error = described_class.from_response(response_body: response_body, status: status)

        expect(error.message).to eq("API error")
        expect(error.status).to eq(500)
        expect(error.code).to eq("API_ERROR")
        expect(error.xendit_response).to be_a(Hash)
        expect(error.xendit_response["message"]).to eq("API error")
      end
    end

    context "with response body missing message and error fields" do
      it "uses default error message" do
        response_body = { "error_code" => "UNKNOWN_ERROR" }
        status = 500

        error = described_class.from_response(response_body: response_body, status: status)

        expect(error.message).to eq("Xendit API error")
        expect(error.status).to eq(500)
        expect(error.code).to eq("UNKNOWN_ERROR")
        expect(error.xendit_response).to eq(response_body)
      end
    end

    context "with response body missing error_code and code fields" do
      it "sets code to nil" do
        response_body = { "message" => "Some error occurred" }
        status = 400

        error = described_class.from_response(response_body: response_body, status: status)

        expect(error.message).to eq("Some error occurred")
        expect(error.status).to eq(400)
        expect(error.code).to be_nil
        expect(error.xendit_response).to eq(response_body)
      end
    end

    context "with invalid JSON string" do
      it "handles JSON parsing error gracefully" do
        response_body = "invalid json string"
        status = 500

        error = described_class.from_response(response_body: response_body, status: status)

        expect(error.message).to eq("Xendit API error (HTTP 500)")
        expect(error.status).to eq(500)
        expect(error.code).to be_nil
        expect(error.xendit_response).to eq("invalid json string")
      end
    end

    context "with empty response body" do
      it "uses default error message" do
        response_body = {}
        status = 404

        error = described_class.from_response(response_body: response_body, status: status)

        expect(error.message).to eq("Xendit API error")
        expect(error.status).to eq(404)
        expect(error.code).to be_nil
        expect(error.xendit_response).to eq(response_body)
      end
    end

    context "with nil response body" do
      it "handles nil response body" do
        response_body = nil
        status = 500

        expect do
          described_class.from_response(response_body: response_body, status: status)
        end.to raise_error(TypeError)
      end
    end
  end

  describe "inheritance" do
    it "inherits from StandardError" do
      expect(described_class.superclass).to eq(StandardError)
    end

    it "can be raised and rescued" do
      expect do
        raise described_class.new(message: "Test error")
      end.to raise_error(described_class, "Test error")
    end
  end
end
