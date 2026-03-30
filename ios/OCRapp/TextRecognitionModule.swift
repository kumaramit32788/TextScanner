import Foundation
import React
import UIKit
import Vision
import CoreImage

@objc(TextRecognitionModule)
class TextRecognitionModule: NSObject {
  private let ciContext = CIContext()

  @objc
  func recognizeText(
    _ imagePath: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    let normalizedPath = imagePath.replacingOccurrences(of: "file://", with: "")

    guard FileManager.default.fileExists(atPath: normalizedPath) else {
      reject("INVALID_IMAGE_PATH", "File not found at path: \(imagePath)", nil)
      return
    }

    guard let image = UIImage(contentsOfFile: normalizedPath) else {
      reject("INVALID_IMAGE_PATH", "Could not decode image from path: \(imagePath)", nil)
      return
    }

    guard let cgImage = preprocessForText(image: image) else {
      reject("PROCESSING_ERROR", "Could not preprocess image for OCR", nil)
      return
    }

    let request = VNRecognizeTextRequest { request, error in
      if let error = error {
        reject("OCR_ERROR", "Text recognition failed", error)
        return
      }

      guard let observations = request.results as? [VNRecognizedTextObservation] else {
        resolve("")
        return
      }

      let text = observations
        .compactMap { $0.topCandidates(1).first?.string }
        .joined(separator: "\n")
      resolve(text)
    }

    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])

    DispatchQueue.global(qos: .userInitiated).async {
      do {
        try handler.perform([request])
      } catch {
        reject("OCR_ERROR", "Text recognition failed", error)
      }
    }
  }

  private func preprocessForText(image: UIImage) -> CGImage? {
    guard let inputCI = CIImage(image: image) else {
      return image.cgImage
    }

    // Convert to grayscale and increase contrast to improve text edge clarity.
    let grayscale = inputCI.applyingFilter(
      "CIColorControls",
      parameters: [
        kCIInputSaturationKey: 0.0,
        kCIInputContrastKey: 1.35
      ]
    )

    let monochrome = grayscale.applyingFilter(
      "CIColorMonochrome",
      parameters: [
        "inputColor": CIColor(red: 1, green: 1, blue: 1),
        "inputIntensity": 1.0
      ]
    )

    guard let output = ciContext.createCGImage(monochrome, from: monochrome.extent) else {
      return image.cgImage
    }

    return output
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }
}
