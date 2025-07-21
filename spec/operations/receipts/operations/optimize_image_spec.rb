# frozen_string_literal: true

require "rails_helper"
require "mini_magick"

RSpec.describe Receipts::Operations::OptimizeImage, type: :operation do
  subject(:operation) { described_class.new }

  # Create a dummy image file for testing
  let(:dummy_image_path) { Rails.root.join("tmp", "test_image.jpg").to_s }
  let(:optimized_image_path) { Rails.root.join("tmp", "test_image_optimized.jpg").to_s }

  before do
    # Ensure the tmp directory exists
    FileUtils.mkdir_p(File.dirname(dummy_image_path))

    # Create a simple dummy image file
    File.open(dummy_image_path, "wb") do |f|
      f.write "dummy_image_content"
    end

    # Clean up optimized image if it exists from a previous run
    FileUtils.rm_f(optimized_image_path)
    FileUtils.rm_f(dummy_image_path.gsub('.jpg', '_optimized.png')) # Clean up potential old optimized file

    # Stub Date.current and Time.current if needed by the operation (check `app/operations/receipts/operations/optimize_image.rb`)
    # Not directly used in this operation, but good practice to keep in mind for future modifications.
  end

  after do
    # Clean up the dummy image files after all tests are run
    FileUtils.rm_f(dummy_image_path)
    FileUtils.rm_f(optimized_image_path)
    FileUtils.rm_f(dummy_image_path.gsub('.jpg', '_optimized.png')) # Ensure cleanup of the generated PNG
  end

  describe "Contract" do
    context "with valid parameters" do
      let(:params) { { image_path: dummy_image_path } }

      before do
        allow(File).to receive(:exist?).and_call_original # Ensure actual file existence check is used
        allow(File).to receive(:exist?).with(dummy_image_path).and_return(true) # Stub for consistency
      end

      it "is successful" do
        result = operation.validate(params:)
        expect(result).to be_success
        expect(result.value!).to include(image_path: dummy_image_path)
      end
    end

    context "with invalid parameters" do
      context "when image_path is missing" do
        let(:params) { { image_path: nil } }

        it "fails with an error" do
          result = operation.validate(params:)
          expect(result).to be_failure
          expect(result.failure).to include(image_path: ['must be a string'])
        end
      end

      context "when image_path is not a string" do
        let(:params) { { image_path: 123 } }

        it "fails with an error" do
          result = operation.validate(params:)
          expect(result).to be_failure
          expect(result.failure).to include(image_path: ['must be a string'])
        end
      end

      context "when image_path file does not exist" do
        let(:params) { { image_path: "/path/to/non_existent_file.jpg" } }

        before do
          allow(File).to receive(:exist?).and_call_original
          allow(File).to receive(:exist?).with(params[:image_path]).and_return(false)
        end

        it "fails with a file does not exist error" do
          result = operation.validate(params:)
          expect(result).to be_failure
          expect(result.failure).to include(image_path: ['file does not exist'])
        end
      end
    end
  end

  describe "#call" do
    let(:mock_image) { double(MiniMagick::Image) }

    before do
      # Stub validate method first
      allow(operation).to receive(:validate).and_return(Dry::Monads::Success({ image_path: dummy_image_path }))
      # Stub subsequent steps
      allow(operation).to receive(:load_image).and_return(Dry::Monads::Success(mock_image))
      allow(operation).to receive(:apply_optimizations).and_return(Dry::Monads::Success(mock_image))
      allow(operation).to receive(:save_optimized_image).and_return(Dry::Monads::Success(optimized_image_path))
    end

    context "when all steps are successful" do
      it "returns the path to the optimized image" do
        result = operation.call(params: { image_path: dummy_image_path })
        expect(result).to be_success
        expect(result.value!).to eq(optimized_image_path)
      end
    end

    context "when a step fails" do
      it "returns a failure if load_image fails" do
        allow(operation).to receive(:load_image).and_return(Dry::Monads::Failure(error: 'Load failed'))
        result = operation.call(params: { image_path: dummy_image_path })
        expect(result).to be_failure
        expect(result.failure).to include(error: 'Load failed')
      end

      it "returns a failure if apply_optimizations fails" do
        allow(operation).to receive(:apply_optimizations).and_return(Dry::Monads::Failure(error: 'Optimization failed'))
        result = operation.call(params: { image_path: dummy_image_path })
        expect(result).to be_failure
        expect(result.failure).to include(error: 'Optimization failed')
      end

      it "returns a failure if save_optimized_image fails" do
        allow(operation).to receive(:save_optimized_image).and_return(Dry::Monads::Failure(error: 'Save failed'))
        result = operation.call(params: { image_path: dummy_image_path })
        expect(result).to be_failure
        expect(result.failure).to include(error: 'Save failed')
      end
    end
  end

  describe "Private Methods" do
    let(:mock_image_instance) { double(MiniMagick::Image) }

    describe "#load_image" do
      context "when image loads successfully" do
        before do
          allow(MiniMagick::Image).to receive(:open).and_return(mock_image_instance)
        end

        it "returns a successful image object" do
          result = operation.__send__(:load_image, params: { image_path: dummy_image_path })
          expect(result).to be_success
          expect(result.value!).to eq(mock_image_instance)
        end
      end

      context "when image loading fails" do
        before do
          allow(MiniMagick::Image).to receive(:open).and_raise(MiniMagick::Error, "Test error")
        end

        it "returns a failure with image_error and original error" do
          result = operation.__send__(:load_image, params: { image_path: dummy_image_path })
          expect(result).to be_failure
          expect(result.failure).to include(
            image_error: "Failed to load image",
            error: instance_of(MiniMagick::Error)
          )
        end
      end
    end

    describe "#apply_optimizations" do
      before do
        allow(mock_image_instance).to receive(:dup).and_return(mock_image_instance)
        allow(operation).to receive(:resize_for_ocr).and_return(mock_image_instance)
        allow(operation).to receive(:convert_to_grayscale).and_return(mock_image_instance)
        allow(operation).to receive(:enhance_contrast).and_return(mock_image_instance)
        allow(operation).to receive(:reduce_noise).and_return(mock_image_instance)
        allow(operation).to receive(:sharpen_text).and_return(mock_image_instance)
        # Add stubs for MiniMagick methods directly called on the image instance within apply_optimizations
        allow(mock_image_instance).to receive(:colorspace).and_return(mock_image_instance)
        allow(mock_image_instance).to receive(:contrast).and_return(mock_image_instance)
        allow(mock_image_instance).to receive(:brightness_contrast).and_return(mock_image_instance)
        allow(mock_image_instance).to receive(:despeckle).and_return(mock_image_instance)
        allow(mock_image_instance).to receive(:blur).and_return(mock_image_instance)
        allow(mock_image_instance).to receive(:unsharp).and_return(mock_image_instance)
      end

      it "applies all optimization steps" do
        result = operation.__send__(:apply_optimizations, original_image: mock_image_instance)
        expect(result).to be_success
        expect(operation).to have_received(:resize_for_ocr).with(mock_image_instance)
        expect(operation).to have_received(:convert_to_grayscale).with(mock_image_instance)
        expect(operation).to have_received(:enhance_contrast).with(mock_image_instance)
        expect(operation).to have_received(:reduce_noise).with(mock_image_instance)
        expect(operation).to have_received(:sharpen_text).with(mock_image_instance)
      end

      context "when an optimization step fails" do
        before do
          allow(operation).to receive(:resize_for_ocr).and_raise(MiniMagick::Error, "Resize error")
        end

        it "returns a failure with optimization_error and original error" do
          result = operation.__send__(:apply_optimizations, original_image: mock_image_instance)
          expect(result).to be_failure
          expect(result.failure).to include(
            optimization_error: "Failed to optimize image",
            error: instance_of(MiniMagick::Error)
          )
        end
      end
    end

    describe "#resize_for_ocr" do
      context "when image width is greater than 2000" do
        before do
          allow(mock_image_instance).to receive(:width).and_return(2500)
          allow(mock_image_instance).to receive(:height).and_return(1500)
          allow(mock_image_instance).to receive(:resize).and_return(mock_image_instance)
        end

        it "resizes the image to target width" do
          operation.__send__(:resize_for_ocr, mock_image_instance)
          expect(mock_image_instance).to have_received(:resize).with("1400x840")
        end
      end

      context "when image width is less than 800" do
        before do
          allow(mock_image_instance).to receive(:width).and_return(700)
          allow(mock_image_instance).to receive(:height).and_return(500)
          allow(mock_image_instance).to receive(:resize).and_return(mock_image_instance)
        end

        it "resizes the image to target width" do
          operation.__send__(:resize_for_ocr, mock_image_instance)
          expect(mock_image_instance).to have_received(:resize).with("1400x1000")
        end
      end

      context "when image width is within optimal range (800-2000)" do
        before do
          allow(mock_image_instance).to receive(:width).and_return(1500)
          allow(mock_image_instance).to receive(:height).and_return(1000)
          allow(mock_image_instance).to receive(:resize).and_return(mock_image_instance) # Still need to allow it to be called, even if not expected
        end

        it "does not resize the image" do
          operation.__send__(:resize_for_ocr, mock_image_instance)
          expect(mock_image_instance).not_to have_received(:resize)
        end
      end
    end

    describe "#convert_to_grayscale" do
      before do
        allow(mock_image_instance).to receive(:colorspace)
      end

      it "converts the image to grayscale" do
        operation.__send__(:convert_to_grayscale, mock_image_instance)
        expect(mock_image_instance).to have_received(:colorspace).with("Gray")
      end
    end

    describe "#enhance_contrast" do
      before do
        allow(mock_image_instance).to receive(:contrast).and_return(mock_image_instance)
        allow(mock_image_instance).to receive(:brightness_contrast).and_return(mock_image_instance)
      end

      it "enhances contrast and brightness" do
        operation.__send__(:enhance_contrast, mock_image_instance)
        expect(mock_image_instance).to have_received(:contrast)
        expect(mock_image_instance).to have_received(:brightness_contrast).with("10x15")
      end
    end

    describe "#reduce_noise" do
      before do
        allow(mock_image_instance).to receive(:despeckle).and_return(mock_image_instance)
        allow(mock_image_instance).to receive(:blur).and_return(mock_image_instance)
      end

      it "reduces noise" do
        operation.__send__(:reduce_noise, mock_image_instance)
        expect(mock_image_instance).to have_received(:despeckle)
        expect(mock_image_instance).to have_received(:blur).with("0x0.5")
      end
    end

    describe "#sharpen_text" do
      before do
        allow(mock_image_instance).to receive(:unsharp).and_return(mock_image_instance)
      end

      it "sharpens text" do
        operation.__send__(:sharpen_text, mock_image_instance)
        expect(mock_image_instance).to have_received(:unsharp).with("0x1+1.0+0.05")
      end
    end

    describe "#save_optimized_image" do
      before do
        allow(mock_image_instance).to receive(:format)
        allow(mock_image_instance).to receive(:write)
        allow(File).to receive(:extname).and_call_original
        allow(File).to receive(:basename).and_call_original
        allow(File).to receive(:dirname).and_call_original
        allow(File).to receive(:join).and_call_original
      end

      context "when image saves successfully" do
        it "saves the optimized image and returns its path" do
          result = operation.__send__(
            :save_optimized_image,
            optimized_image: mock_image_instance,
            params: { image_path: dummy_image_path }
          )
          expect(result).to be_success
          expect(result.value!).to eq(optimized_image_path)
          expect(mock_image_instance).to have_received(:format).with("png")
          expect(mock_image_instance).to have_received(:write).with(optimized_image_path)
        end
      end

      context "when image saving fails" do
        before do
          allow(mock_image_instance).to receive(:write).and_raise(MiniMagick::Error, "Save error")
        end

        it "returns a failure with save_error and original error" do
          result = operation.__send__(
            :save_optimized_image,
            optimized_image: mock_image_instance,
            params: { image_path: dummy_image_path }
          )
          expect(result).to be_failure
          expect(result.failure).to include(
            save_error: "Failed to save optimized image",
            error: instance_of(MiniMagick::Error)
          )
        end
      end
    end
  end
end
