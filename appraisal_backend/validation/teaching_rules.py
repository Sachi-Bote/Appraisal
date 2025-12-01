#these rules are meant for the table 1 in the appraisal form 

def teaching_input(data):
    if data["classes_taught"] > data["assigned_classes"]:  
        return False, "Error: Classes taught cannot exceed total classes."
    
    if data["assigned_classes"] <= 0:
        return False, "Error: Assigned classes must be greater than zero."
    
    return True, None

