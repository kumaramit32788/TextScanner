package com.amit.textscanner

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
import androidx.exifinterface.media.ExifInterface
import com.facebook.react.bridge.*
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.io.File

class TextRecognitionModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "TextRecognitionModule"

    @ReactMethod
    fun recognizeText(imagePath: String, promise: Promise) {
        try {
            val normalizedPath = imagePath.removePrefix("file://")
            val bitmap = BitmapFactory.decodeFile(normalizedPath)
            if (bitmap == null) {
                promise.reject("INVALID_IMAGE_PATH", "Could not decode image from path: $imagePath")
                return
            }
            val rotatedBitmap = rotateBitmapIfRequired(bitmap, normalizedPath)
            val preprocessedBitmap = preprocessForText(rotatedBitmap)
            val image = InputImage.fromBitmap(preprocessedBitmap, 0)

            val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

            recognizer.process(image)
                .addOnSuccessListener { visionText ->
                    promise.resolve(visionText.text)
                }
                .addOnFailureListener { e ->
                    promise.reject("OCR_ERROR", e)
                }

        } catch (e: Exception) {
            promise.reject("ERROR", e)
        }
    }

    private fun rotateBitmapIfRequired(bitmap: Bitmap, imagePath: String): Bitmap {
        val file = File(imagePath)
        if (!file.exists()) {
            return bitmap
        }

        val exif = ExifInterface(imagePath)
        val orientation = exif.getAttributeInt(
            ExifInterface.TAG_ORIENTATION,
            ExifInterface.ORIENTATION_NORMAL
        )

        val angle = when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> 90f
            ExifInterface.ORIENTATION_ROTATE_180 -> 180f
            ExifInterface.ORIENTATION_ROTATE_270 -> 270f
            else -> 0f
        }

        if (angle == 0f) {
            return bitmap
        }

        val matrix = android.graphics.Matrix().apply { postRotate(angle) }
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    }

    private fun preprocessForText(bitmap: Bitmap): Bitmap {
        // Convert to grayscale and boost contrast to make text edges stronger.
        val grayscaleBitmap = Bitmap.createBitmap(bitmap.width, bitmap.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(grayscaleBitmap)
        val paint = Paint()
        val colorMatrix = ColorMatrix().apply { setSaturation(0f) }
        paint.colorFilter = ColorMatrixColorFilter(colorMatrix)
        canvas.drawBitmap(bitmap, 0f, 0f, paint)

        val pixels = IntArray(grayscaleBitmap.width * grayscaleBitmap.height)
        grayscaleBitmap.getPixels(
            pixels,
            0,
            grayscaleBitmap.width,
            0,
            0,
            grayscaleBitmap.width,
            grayscaleBitmap.height
        )

        // Simple adaptive-ish threshold using global average intensity.
        var total = 0L
        for (pixel in pixels) {
            total += Color.red(pixel)
        }
        val avg = (total / pixels.size).toInt()
        val threshold = (avg * 0.9).toInt().coerceIn(80, 200)

        for (i in pixels.indices) {
            val value = Color.red(pixels[i])
            pixels[i] = if (value > threshold) Color.WHITE else Color.BLACK
        }

        grayscaleBitmap.setPixels(
            pixels,
            0,
            grayscaleBitmap.width,
            0,
            0,
            grayscaleBitmap.width,
            grayscaleBitmap.height
        )

        return grayscaleBitmap
    }
}
