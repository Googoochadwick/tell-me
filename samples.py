import json
import random

ERROR_TEMPLATES = [
    {
        "error": "error: expected ';' before '}' token",
        "bad_code": "int main() {\n    int x = 10\n}",
        "good_code": "int main() {\n    int x = 10;\n}",
        "meaning": "The compiler expected a semicolon to end a statement but found a closing brace instead.",
        "rule": "Every statement in C/C++ must end with a semicolon."
    },
    {
        "error": "error: 'cout' was not declared in this scope",
        "bad_code": "int main() {\n    cout << \"Hello\";\n}",
        "good_code": "#include <iostream>\nusing namespace std;\nint main() {\n    cout << \"Hello\";\n}",
        "meaning": "The compiler does not recognize cout because it was not properly included.",
        "rule": "Standard library features require proper headers."
    },
    {
        "error": "error: expected declaration or statement at end of input",
        "bad_code": "int main() {\n    printf(\"Hi\");",
        "good_code": "int main() {\n    printf(\"Hi\");\n}",
        "meaning": "The compiler reached the end of the file while still expecting more code.",
        "rule": "Every opening brace must have a matching closing brace."
    },
    {
        "error": "error: too few arguments to function",
        "bad_code": "void add(int a, int b) {}\nint main() {\n    add(5);\n}",
        "good_code": "void add(int a, int b) {}\nint main() {\n    add(5, 10);\n}",
        "meaning": "The function was called without all the required arguments.",
        "rule": "Functions must be called with the correct number of arguments."
    },
    {
        "error": "error: invalid conversion from 'int' to 'int*'",
        "bad_code": "int x = 5;\nint* p = x;",
        "good_code": "int x = 5;\nint* p = &x;",
        "meaning": "A pointer was given a normal value instead of an address.",
        "rule": "Pointers must store addresses, not values."
    },
    {
        "error": "error: array subscript is not an integer",
        "bad_code": "int arr[5];\narr[\"one\"] = 10;",
        "good_code": "int arr[5];\narr[1] = 10;",
        "meaning": "Array indices must be integers.",
        "rule": "Use only integer values to index arrays."
    },
    {
        "error": "error: 'x' was not declared in this scope",
        "bad_code": "int main() {\n    cout << x;\n}",
        "good_code": "int main() {\n    int x = 10;\n    cout << x;\n}",
        "meaning": "The variable was used before being declared.",
        "rule": "Variables must be declared before use."
    },
    {
        "error": "error: redefinition of 'int x'",
        "bad_code": "int x = 5;\nint x = 10;",
        "good_code": "int x = 5;\nx = 10;",
        "meaning": "The variable was declared more than once in the same scope.",
        "rule": "A variable can only be declared once per scope."
    },
    {
        "error": "error: invalid operands to binary +",
        "bad_code": "int x = 5;\nchar* s = \"hi\";\nint y = x + s;",
        "good_code": "int x = 5;\nint y = x + 10;",
        "meaning": "The addition operator was used with incompatible types.",
        "rule": "Binary operators require compatible data types."
    },
    {
        "error": "error: expected ')' before '{' token",
        "bad_code": "if (x > 5 {\n    x++;\n}",
        "good_code": "if (x > 5) {\n    x++;\n}",
        "meaning": "The condition is missing a closing parenthesis.",
        "rule": "Conditional expressions must be enclosed in parentheses."
    }
]

def generate_sample(template, index):
    return {
        "input": template["error"],
        "output": (
            "🟥 Error Overview\n"
            f"Error Message: {template['error']}\n"
            "Language / Tool: C/C++ Compiler\n\n"
            "📍 Where the Error Occurs\n"
            "File: main.cpp\n"
            f"Line: {random.randint(3, 15)}\n"
            "Code Context: A statement is being processed by the compiler.\n\n"
            "🧠 What the Error Means (Plain English)\n"
            f"{template['meaning']}\n\n"
            "❓ Why This Error Happens\n"
            "Cause 1: Incorrect syntax or usage\n\n"
            "❌ Problematic Code\n"
            f"{template['bad_code']}\n\n"
            "Explanation: The code violates a C/C++ language rule.\n\n"
            "✅ Corrected Code\n"
            f"{template['good_code']}\n\n"
            "Explanation: The code now follows correct syntax and rules.\n\n"
            "📌 Rule to Remember\n"
            f"{template['rule']}\n\n"
            "📝 One-Line Summary\n"
            "The error occurred due to incorrect code structure and was fixed by correcting it."
        )
    }

def generate_dataset(num_samples=50):
    dataset = []
    for i in range(num_samples):
        template = random.choice(ERROR_TEMPLATES)
        dataset.append(generate_sample(template, i))
    return dataset

if __name__ == "__main__":
    data = generate_dataset(50)
    with open("c_cpp_error_dataset_50.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print("✅ Generated c_cpp_error_dataset_50.json with 50 samples")
