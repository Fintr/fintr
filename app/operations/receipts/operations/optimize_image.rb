# frozen_string_literal: true

module Receipts
  module Operations
    class OptimizeImage < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:image_path).value(:string)
        end

        rule(:image_path) do
          key.failure("file does not exist") unless File.exist?(value)
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      include FailureHandler

      def call(params:)
        params            = step validate(params:)
        original_image    = step load_image(params:)
        optimized_image   = step apply_optimizations(original_image:)
        output_path       = step save_optimized_image(optimized_image:, params:)
        output_path
      end

      private

      def load_image(params:)
        image = MiniMagick::Image.open(params[:image_path])
        Success(image)
      rescue MiniMagick::Error => e
        Failure(
          image_error: "Failed to load image",
          error: e
        )
      end

      def apply_optimizations(original_image:)
        image = original_image.dup

        # Step 1: Resize to optimal dimensions for OCR
        # Tesseract works best with images between 300-600 DPI
        image = resize_for_ocr(image)

        # Step 2: Convert to grayscale to improve OCR accuracy
        image = convert_to_grayscale(image)

        # Step 3: Enhance contrast and brightness
        image = enhance_contrast(image)

        # Step 4: Reduce noise
        image = reduce_noise(image)

        # Step 5: Sharpen text
        image = sharpen_text(image)

        Success(image)
      rescue MiniMagick::Error => e
        Failure(
          optimization_error: "Failed to optimize image",
          error: e
        )
      end

      def resize_for_ocr(image)
        # Get current dimensions
        width = image.width
        height = image.height

        # Target width for good OCR results (1200-1600px is optimal)
        target_width = 1400

        # Only resize if image is too large or too small
        if width > 2000 || width < 800
          # Calculate proportional height
          target_height = (height * target_width.to_f / width).round

          image.resize "#{target_width}x#{target_height}"
        end

        image
      end

      def convert_to_grayscale(image)
        image.colorspace "Gray"
        image
      end

      def enhance_contrast(image)
        # Enhance contrast and brightness for better text recognition
        image.contrast # Apply contrast enhancement
        image.brightness_contrast "10x15" # Brightness: +10%, Contrast: +15%
        image
      end

      def reduce_noise(image)
        # Apply noise reduction while preserving text clarity
        image.despeckle # Remove speckle noise
        image.blur "0x0.5" # Very light blur to reduce noise
        image
      end

      def sharpen_text(image)
        # Sharpen to make text edges more defined
        image.unsharp "0x1+1.0+0.05" # Mild sharpening optimized for text
        image
      end

      def save_optimized_image(optimized_image:, params:)
        # Generate output filename
        original_path = params[:image_path]
        file_extension = File.extname(original_path)
        base_name = File.basename(original_path, file_extension)
        directory = File.dirname(original_path)

        output_filename = "#{base_name}_optimized#{file_extension}"
        output_path = File.join(directory, output_filename)

        # Save the optimized image
        optimized_image.format "png" # PNG preserves quality better for OCR
        optimized_image.write output_path

        Success(output_path)
      rescue MiniMagick::Error => e
        Failure(
          save_error: "Failed to save optimized image",
          error: e
        )
      end
    end
  end
end
